"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * 카페 지도 (MapLibre + OpenFreeMap).
 *
 * API 키가 필요 없다. 카카오맵·구글맵은 키 발급과 도메인 등록이 있어야 하고
 * 구글은 월 10,000 로드를 넘기면 과금되는데, OpenFreeMap은 오픈소스 타일 서버라
 * 키·가입·조회수 제한이 없다. 대신 무료 프로젝트라 가동률 보장이 없으므로
 * 타일 로드 실패 시 목록으로 내려간다.
 */

type MapCafe = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SEOUL: [number, number] = [126.978, 37.5665];
// 카페 하나를 들여다보는 수준. 전체를 fitBounds하면 천안·부산이 섞여 한국 전체가
// 나오고 정작 각 카페는 점으로만 보인다.
const CAFE_ZOOM = 16;

export default function OpenMapModal({
  isOpen,
  onClose,
  cafes,
  selectedCafe,
}: {
  isOpen: boolean;
  onClose: () => void;
  cafes: MapCafe[];
  selectedCafe?: MapCafe | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  // 호출부가 배열을 인라인으로 만들면 매 렌더마다 새 참조가 된다. 그것을 effect
  // 의존성에 두면 초기화가 계속 취소돼 지도가 비어 버린다 — ref로 최신값만 읽는다.
  const cafesRef = useRef(cafes);
  cafesRef.current = cafes;
  const selectedRef = useRef(selectedCafe);
  selectedRef.current = selectedCafe;
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<MapCafe | null>(null);
  const [idx, setIdx] = useState(0);

  // 특정 카페로 이동. 전체를 한 화면에 담지 않고 하나씩 확대해 보여준다.
  const goTo = (i: number) => {
    const list = cafesRef.current;
    if (!list.length) return;
    const n = ((i % list.length) + list.length) % list.length;
    setIdx(n);
    const c = list[n];
    setPicked(c);
    const m = mapRef.current as { flyTo?: (o: unknown) => void } | null;
    m?.flyTo?.({ center: [c.lng, c.lat], zoom: CAFE_ZOOM, duration: 600 });
  };

  useEffect(() => {
    if (!isOpen || !containerRef.current || mapRef.current) return;

    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    (async () => {
      try {
        // maplibre-gl은 5.6.0으로 고정했다. 6.x에서는 같은 스타일·컨테이너로도
        // 배경만 칠하고 벡터 타일을 그리지 않았다(브라우저에서 v5는 정상 렌더 확인).
        const maplibre = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;

        const list = cafesRef.current;
        const sel = selectedRef.current;
        const center: [number, number] = sel
          ? [sel.lng, sel.lat]
          : list.length
            ? [list[0].lng, list[0].lat]
            : SEOUL;

        const map = new maplibre.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center,
          zoom: CAFE_ZOOM,
        });
        mapRef.current = map;
        // 검증용 핸들. 자동화 브라우저는 탭이 항상 백그라운드라
        // requestAnimationFrame이 0회 실행되고, MapLibre는 rAF로 그리므로
        // 화면이 비어 보인다. map._render()를 직접 부르고 gl.readPixels로
        // 픽셀을 비교하는 것이 유일한 검증 방법이라 인스턴스를 노출한다.
        (window as unknown as { __coffeeMap?: unknown }).__coffeeMap = map;

        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => setFailed(true));

        setPicked(sel ?? list[0] ?? null);
        setIdx(sel ? Math.max(0, list.findIndex((c) => c.id === sel.id)) : 0);

        // 마커는 DOM 오버레이라 스타일 로드를 기다릴 필요가 없다.
        // load 안에 두면 그 이벤트가 늦거나 안 올 때 마커까지 사라진다.
        {
          for (const c of cafesRef.current) {
            const el = document.createElement("button");
            el.type = "button";
            el.setAttribute("aria-label", c.name);
            el.className =
              "w-7 h-7 rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-110";
            el.style.background = c.id === selectedRef.current?.id ? "#e05252" : "#c5a880";
            el.onclick = (e) => {
              e.stopPropagation();
              setPicked(c);
              setIdx(cafesRef.current.findIndex((x) => x.id === c.id));
              map.flyTo({ center: [c.lng, c.lat], zoom: CAFE_ZOOM, duration: 600 });
            };
            new maplibre.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map);
          }
        }

        // 모달 안에서는 지도가 만들어지는 시점에 컨테이너 크기가 아직 0이다.
        // 그러면 MapLibre가 필요한 타일 범위를 계산하지 못해 타일 요청을 아예
        // 보내지 않는다(스타일·스프라이트만 받고 화면이 빈 채로 멈춘다).
        // 레이아웃이 잡힌 뒤 resize를 불러줘야 한다.
        const ro = new ResizeObserver(() => map.resize());
        ro.observe(containerRef.current);
        resizeObs = ro;
        requestAnimationFrame(() => map.resize());
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
    };
  }, [isOpen]);

  // 닫을 때 지도를 정리한다. 남겨두면 다시 열 때 컨테이너가 어긋난다.
  useEffect(() => {
    if (isOpen) return;
    const m = mapRef.current as { remove?: () => void } | null;
    m?.remove?.();
    mapRef.current = null;
    setPicked(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-[#120f0d] overflow-hidden">
        <div className="flex items-start justify-between p-4 border-b border-white/5">
          <div>
            <h3 className="font-display text-lg font-bold text-[#f8f6f3]">카페 지도</h3>
            <p className="mt-0.5 text-xs text-[#f8f6f3]/50">
              총 {cafes.length}개 카페{failed ? " · 지도를 불러오지 못해 목록으로 표시합니다" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-[#f8f6f3]/60 hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {failed ? (
          <ul className="flex-1 overflow-y-auto p-4 space-y-2">
            {cafes.map((c) => (
              <li key={c.id} className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <div className="text-sm font-semibold text-[#f8f6f3]">{c.name}</div>
                <div className="mt-0.5 text-xs text-[#f8f6f3]/55">{c.address}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="relative flex-1 min-h-0">
            {/* maplibre-gl.css가 .maplibregl-map에 position:relative를 걸어 우리
                absolute를 덮어쓴다. 그러면 inset-0이 무력화돼 높이가 0이 되고,
                MapLibre가 뷰포트를 0으로 보고 타일을 아예 요청하지 않는다.
                크기를 직접 준다. */}
            <div ref={containerRef} className="w-full h-full" />
            {picked && (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-[#120f0d]/95 backdrop-blur p-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goTo(idx - 1)}
                  aria-label="이전 카페"
                  className="min-w-11 min-h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-[#c5a880] hover:bg-white/5"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="truncate text-sm font-semibold text-[#f8f6f3]">{picked.name}</div>
                  <div className="truncate mt-0.5 text-xs text-[#f8f6f3]/55">{picked.address}</div>
                  <div className="mt-1 text-[10px] text-[#f8f6f3]/40">
                    {idx + 1} / {cafes.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goTo(idx + 1)}
                  aria-label="다음 카페"
                  className="min-w-11 min-h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-[#c5a880] hover:bg-white/5"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
