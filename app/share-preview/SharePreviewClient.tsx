"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import ShareComposer from "../components/ShareComposer";
import type { CoffeeShareSourceRecord } from "../utils/share";

type WorkflowExtraction = {
  cafe?: string;
  bean?: string;
  processing?: string;
  flavor?: string[];
  origin?: string;
  roast_level?: string;
  raw_text?: string;
  source?: string;
  confidence?: number;
};

type TesseractModule = {
  recognize: (
    image: File,
    langs?: string,
    options?: {
      logger?: (message: unknown) => void;
      tessedit_pageseg_mode?: number;
      preserve_interword_spaces?: string;
      user_defined_dpi?: string;
    },
  ) => Promise<{ data?: { text?: string } }>;
};

const sampleRecord: CoffeeShareSourceRecord = {
  id: "preview-record",
  cafe: "센터커피 홍대점",
  bean: "KENYA AA TOP KIYARA 517",
  flavor: ["Raspberry", "Cranberry", "Black Tea", "Silky"],
  rating: 4.5,
  brewMethod: "Drip",
  processing: "Washed",
  createdAt: "2026-05-24T09:30:00.000Z",
  imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  review: "라즈베리와 크랜베리의 산뜻함 뒤로 홍차 같은 여운이 길게 남아요.",
  origin: "Kenya",
  roastLevel: "Medium-Light",
  locationLabel: "홍대입구",
};

let tesseractModule: TesseractModule | null = null;

async function ensureTesseract() {
  if (tesseractModule) return tesseractModule;
  const tesseractImport = await import("tesseract.js");
  tesseractModule = tesseractImport.default as TesseractModule;
  return tesseractModule;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function createFileFromRoute(route: string, fileName: string) {
  const response = await fetch(route);
  if (!response.ok) {
    throw new Error("샘플 이미지를 불러오지 못했습니다.");
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

function normalizeFlavor(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

async function runTesseractFallback(image: File) {
  const Tesseract = await ensureTesseract();
  const { data } = await Tesseract.recognize(image, "kor+eng", {
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  return (data?.text || "").trim();
}

async function extractViaLlm(rawText: string) {
  const response = await fetch("/api/llm-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: rawText,
      confidence: 0.82,
    }),
  });

  if (!response.ok) {
    throw new Error("텍스트 구조화에 실패했습니다.");
  }

  const result = await response.json();
  return {
    cafe: result.cafe || "",
    bean: result.bean || "",
    processing: result.processing || "",
    flavor: normalizeFlavor(result.flavor),
    origin: result.origin || "",
    roast_level: result.roast_level || "",
    raw_text: rawText,
    source: result.source || "llm-extract",
    confidence: result.confidence || 0.6,
  } satisfies WorkflowExtraction;
}

async function extractFromLabelImage(image: File) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("mode", "coffee");

  try {
    const response = await fetch("/api/glm-ocr", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("GLM-OCR failed");
    }

    const result = await response.json();
    const extraction = {
      cafe: result.cafe || "",
      bean: result.bean || "",
      processing: result.processing || "",
      flavor: normalizeFlavor(result.flavor),
      origin: result.origin || "",
      roast_level: result.roast_level || "",
      raw_text: result.raw_text || "",
      source: result.source || "glm-ocr",
      confidence: result.confidence || 0.6,
    } satisfies WorkflowExtraction;

    if (extraction.bean || extraction.flavor?.length) {
      return extraction;
    }

    if (extraction.raw_text) {
      return extractViaLlm(extraction.raw_text);
    }
  } catch {
    // Tesseract fallback handled below.
  }

  const rawText = await runTesseractFallback(image);
  if (!rawText) {
    throw new Error("라벨 이미지에서 텍스트를 읽지 못했습니다.");
  }

  return extractViaLlm(rawText);
}

export default function SharePreviewClient() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState("");
  const [record, setRecord] = useState<CoffeeShareSourceRecord>(sampleRecord);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string>(sampleRecord.imageUrl || "");
  const [labelPreview, setLabelPreview] = useState("");
  const [workflowState, setWorkflowState] = useState<"idle" | "analyzing" | "ready">("idle");
  const [workflowError, setWorkflowError] = useState("");
  const [rawText, setRawText] = useState("");
  const [extraction, setExtraction] = useState<WorkflowExtraction | null>(null);
  const [sampleHydrated, setSampleHydrated] = useState(false);

  const flavorLine = useMemo(() => {
    const flavors = extraction?.flavor || record.flavor || [];
    return Array.isArray(flavors) ? flavors.join(" · ") : "";
  }, [extraction, record.flavor]);

  useEffect(() => {
    const backgroundPath = searchParams.get("backgroundPath");
    const labelPath = searchParams.get("labelPath");
    const autorun = searchParams.get("autorun") === "1";

    if (!backgroundPath || !labelPath || sampleHydrated) return;

    let cancelled = false;

    const hydrateFromQuery = async () => {
      try {
        const backgroundFileFromQuery = await createFileFromRoute(
          `/api/local-image?path=${encodeURIComponent(backgroundPath)}`,
          backgroundPath.split("/").pop() || "background.jpg",
        );
        const labelFileFromQuery = await createFileFromRoute(
          `/api/local-image?path=${encodeURIComponent(labelPath)}`,
          labelPath.split("/").pop() || "label.jpg",
        );
        const [backgroundDataUrl, labelDataUrl] = await Promise.all([
          readFileAsDataUrl(backgroundFileFromQuery),
          readFileAsDataUrl(labelFileFromQuery),
        ]);

        if (cancelled) return;

        setBackgroundFile(backgroundFileFromQuery);
        setLabelFile(labelFileFromQuery);
        setBackgroundPreview(backgroundDataUrl);
        setLabelPreview(labelDataUrl);
        setRecord((current) => ({ ...current, imageUrl: backgroundDataUrl }));

        if (autorun) {
          setToast("샘플 이미지를 불러왔습니다. 라벨 분석을 시작합니다.");
          setWorkflowState("analyzing");
          const result = await extractFromLabelImage(labelFileFromQuery);
          if (cancelled) return;

          setExtraction(result);
          setRawText(result.raw_text || "");
          setRecord((current) => ({
            ...current,
            imageUrl: backgroundDataUrl,
            cafe: result.cafe || current.cafe || "",
            bean: result.bean || current.bean || "",
            processing: result.processing || current.processing || "",
            brewMethod: result.processing || current.brewMethod || "Coffee Journal",
            flavor: result.flavor && result.flavor.length > 0 ? result.flavor : current.flavor || [],
            origin: result.origin || current.origin || "",
            roastLevel: result.roast_level || current.roastLevel || "",
            review:
              current.review ||
              "라벨에서 추출한 향미를 인물 사진 위에 감각적으로 오버레이한 공유 카드입니다.",
          }));
          setWorkflowState("ready");
          setToast(`샘플 워크플로우 완료: ${result.bean || "원두명 미확인"}`);
          setSampleHydrated(true);
          return;
        }

        setSampleHydrated(true);
      } catch (error) {
        if (cancelled) return;
        setWorkflowError(error instanceof Error ? error.message : "샘플 이미지를 불러오지 못했습니다.");
        setSampleHydrated(true);
        setWorkflowState("idle");
      }
    };

    hydrateFromQuery();

    return () => {
      cancelled = true;
    };
  }, [sampleHydrated, searchParams]);

  const handleBackgroundChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setBackgroundFile(file);
    setBackgroundPreview(dataUrl);
    setRecord((current) => ({ ...current, imageUrl: dataUrl }));
  };

  const handleLabelChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setLabelFile(file);
    setLabelPreview(dataUrl);
  };

  const handleRunWorkflow = async () => {
    if (!backgroundFile || !labelFile) {
      setWorkflowError("배경 사진과 라벨 사진을 모두 선택해주세요.");
      return;
    }

    try {
      setWorkflowState("analyzing");
      setWorkflowError("");
      setToast("");
      const result = await extractFromLabelImage(labelFile);
      setExtraction(result);
      setRawText(result.raw_text || "");

      const nextRecord: CoffeeShareSourceRecord = {
        ...record,
        imageUrl: backgroundPreview,
        cafe: result.cafe || record.cafe || "",
        bean: result.bean || record.bean || "",
        processing: result.processing || record.processing || "",
        brewMethod: result.processing || record.brewMethod || "Coffee Journal",
        flavor: result.flavor && result.flavor.length > 0 ? result.flavor : record.flavor || [],
        origin: result.origin || record.origin || "",
        roastLevel: result.roast_level || record.roastLevel || "",
        review:
          record.review ||
          "라벨에서 추출한 향미를 인물 사진 위에 감각적으로 오버레이한 공유 카드입니다.",
      };

      setRecord(nextRecord);
      setWorkflowState("ready");
      setToast(`워크플로우 완료: ${result.bean || "원두명 미확인"} / ${(result.flavor || []).join(", ") || "향미 없음"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "워크플로우 실행 중 오류가 발생했습니다.";
      setWorkflowError(message);
      setWorkflowState("idle");
    }
  };

  return (
    <main className="min-h-screen bg-[#1f1511] p-4 text-coffee-light">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-2xl font-bold">ShareComposer Preview</h1>
          <p className="mt-2 text-sm text-coffee-light/70">
            로그인 없이 SNS 카드 생성 모달과 라벨 OCR 워크플로우를 함께 확인하는 임시 프리뷰입니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link href="/history" className="text-sm text-coffee-gold underline">
              히스토리로 돌아가기
            </Link>
            <span className="rounded-full border border-coffee-gold/20 bg-coffee-gold/10 px-3 py-1 text-xs text-coffee-light/80">
              라벨 OCR → 인물 사진 오버레이 → 공유 카드
            </span>
          </div>
          {toast && (
            <div className="mt-4 rounded-2xl border border-coffee-gold/20 bg-coffee-gold/10 px-4 py-3 text-sm text-coffee-light">
              {toast}
            </div>
          )}
          {workflowError && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {workflowError}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-[#241914] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Workflow Lab</h2>
                <p className="mt-1 text-sm text-coffee-light/65">
                  라벨 사진에서 추출한 원두명과 향미를 다른 커피 사진 위의 스토리/AI 카드로 바로 넘깁니다.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-coffee-gold/80">
                {workflowState === "analyzing" ? "analyzing" : workflowState === "ready" ? "ready" : "idle"}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="text-sm font-medium text-coffee-light">1. 배경 커피 사진</div>
                <div className="mt-1 text-xs text-coffee-light/60">인물 사진이나 카페 컷을 넣으면 그 위에 데이터가 올라갑니다.</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundChange}
                  className="mt-4 block w-full text-sm text-coffee-light file:mr-4 file:rounded-full file:border-0 file:bg-coffee-gold/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-coffee-light"
                />
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img src={backgroundPreview} alt="background preview" className="h-56 w-full object-cover" />
                </div>
              </label>

              <label className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="text-sm font-medium text-coffee-light">2. 커피 라벨 사진</div>
                <div className="mt-1 text-xs text-coffee-light/60">원두명, 프로세싱, 향미가 적힌 라벨/커피백을 넣어주세요.</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLabelChange}
                  className="mt-4 block w-full text-sm text-coffee-light file:mr-4 file:rounded-full file:border-0 file:bg-coffee-gold/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-coffee-light"
                />
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {labelPreview ? (
                    <img src={labelPreview} alt="label preview" className="h-56 w-full object-cover" />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-coffee-light/45">라벨 사진을 선택해주세요.</div>
                  )}
                </div>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRunWorkflow}
                disabled={workflowState === "analyzing"}
                className="rounded-full bg-coffee-gold px-5 py-3 text-sm font-semibold text-[#261912] transition hover:bg-[#d6a668] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workflowState === "analyzing" ? "라벨 분석 중..." : "라벨 분석 후 공유 카드 만들기"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecord(sampleRecord);
                  setBackgroundFile(null);
                  setLabelFile(null);
                  setBackgroundPreview(sampleRecord.imageUrl || "");
                  setLabelPreview("");
                  setExtraction(null);
                  setRawText("");
                  setWorkflowError("");
                  setWorkflowState("idle");
                  setSampleHydrated(false);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-coffee-light/85"
              >
                샘플 상태로 되돌리기
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-coffee-gold/70">Extracted</div>
                <div className="mt-3 space-y-3 text-sm text-coffee-light/80">
                  <div>
                    <div className="text-coffee-light/45">원두명</div>
                    <div className="mt-1 font-medium text-coffee-light">{record.bean || "없음"}</div>
                  </div>
                  <div>
                    <div className="text-coffee-light/45">카페명</div>
                    <div className="mt-1 font-medium text-coffee-light">{record.cafe || "없음"}</div>
                  </div>
                  <div>
                    <div className="text-coffee-light/45">프로세싱</div>
                    <div className="mt-1 font-medium text-coffee-light">{record.processing || "없음"}</div>
                  </div>
                  <div>
                    <div className="text-coffee-light/45">향미</div>
                    <div className="mt-1 font-medium text-coffee-light">{flavorLine || "없음"}</div>
                  </div>
                  <div>
                    <div className="text-coffee-light/45">소스</div>
                    <div className="mt-1 font-medium text-coffee-light">{extraction?.source || "sample"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-coffee-gold/70">OCR Raw Text</div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-coffee-light/70">
                  {rawText || "아직 라벨 OCR을 실행하지 않았습니다."}
                </pre>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">ShareComposer</h2>
            <p className="mt-1 text-sm text-coffee-light/65">
              워크플로우가 완료되면 아래 모달은 배경 사진과 추출값을 바로 반영합니다.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-coffee-light/75">
              기본 진입은 <span className="font-semibold text-coffee-gold">Story Editor</span>로 열리며, AI 스타일 카드와 Sensory preset도 바로 테스트할 수 있습니다.
            </div>
          </section>
        </div>
      </div>

      <ShareComposer
        record={record}
        open
        onClose={() => {}}
        onToast={setToast}
        initialLayoutMode="story"
      />
    </main>
  );
}
