"use client";
import { useState, useEffect } from "react";
import { db, auth } from "../../src/firebase";
import { collection, setDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import GoogleMapView from './GoogleMapView';

// Cafe 인터페이스 복구
interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags?: string[];
  flavor?: string;
  menu?: string;
  imageUrl?: string;
  rating?: number;
  signature_menu?: string[];
  flavor_tags?: string[];
  flavor_main?: string;
  features?: {
    laptop_friendly?: boolean;
    quiet?: boolean;
    sunny?: boolean;
    dessert?: boolean;
    instagrammable?: boolean;
  };
  crawlConfig?: {
    enabled: boolean;
    successRate: number;
    crawlInterval: number;
    lastCrawled?: string;
  };
  createdAt?: string;
  lastUpdated?: string;
}

const FLAVOR_OPTIONS = ["Floral", "Chocolate", "Nutty", "Fruity", "Earthy", "Sweet"];
const TAGS_ICON: { [key: string]: string } = { "조용함": "🔇", "채광 좋음": "☀️", "노트북 가능": "💻", "로스터리": "🔥", "테이스팅룸": "🧑‍🔬", "한옥": "🏯", "모던": "🏢", "빈티지": "📻", "공장 리모델링": "🏭", "포토존": "📸", "베이커리": "🥐", "성당 느낌": "⛪" };
const MENU_ICON: { [key: string]: string } = { "에스프레소": "☕", "드립커피": "🫖", "콜드브루": "🧊", "플로럴 블렌드": "🌸", "프렌치프레스": "🥄", "크루아상": "🥐", "베이커리 플래터": "🍞", "티라미수": "🍰", "라떼": "🥛", "시그니처 음료": "⭐" };
const FLAVOR_ICON: { [key: string]: string } = { "Floral": "🌸", "Fruity": "🍑", "Sweet": "🍯", "Nutty": "🥜", "Chocolate": "🍫", "Earthy": "🌱", "Herbal": "🌿", "Smoky": "🔥", "Juicy": "🍹", "Bitter": "☕", "Bright": "✨", "Balanced": "⚖️" };

function getRandomElement<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type { Cafe };
export default function CafeClient({ weather, weatherEmoji, cafes, todayCafe: ssrTodayCafe, userPreferenceDefault }: { weather: string, weatherEmoji: string, cafes: Cafe[], todayCafe: Cafe | null, userPreferenceDefault: string }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"distance"|"name">("distance");
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [userPreference, setUserPreference] = useState(userPreferenceDefault);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [todayCafe, setTodayCafe] = useState<Cafe | null>(ssrTodayCafe);
  const [page, setPage] = useState(1);
  const itemsPerPage = 9;
  const [userRecordCount, setUserRecordCount] = useState<number>(0);

  const filteredCafes = cafes.filter(cafe => {
    let match = true;
    if (selectedTag && !(cafe.tags || []).includes(selectedTag)) match = false;
    if (selectedFlavor && !(cafe.flavor_tags || []).includes(selectedFlavor)) match = false;
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = cafe.name.toLowerCase().includes(searchLower);
      const menuMatch = cafe.menu?.toLowerCase().includes(searchLower);
      const signatureMenuMatch = cafe.signature_menu?.some(menu => 
        menu.toLowerCase().includes(searchLower)
      );
      if (!nameMatch && !menuMatch && !signatureMenuMatch) match = false;
    }
    return match;
  });
  const totalPages = Math.ceil(filteredCafes.length / itemsPerPage);
  const pagedCafes = filteredCafes.slice((page-1)*itemsPerPage, page*itemsPerPage);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) {
      setWishlist([]);
      setUserRecordCount(0);
      return;
    }
    const fetchWishlist = async () => {
      const snap = await getDocs(collection(db, `users/${user.uid}/favorites`));
      setWishlist(snap.docs.map(doc => doc.id));
    };
    fetchWishlist();
    getDocs(collection(db, `users/${user.uid}/record`)).then(snap => {
      setUserRecordCount(snap.size);
    });
  }, [user]);
  const toggleWishlist = async (cafeId: string) => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/favorites`, cafeId);
    if (wishlist.includes(cafeId)) {
      await deleteDoc(ref);
      setWishlist(wishlist.filter(id => id !== cafeId));
    } else {
      await setDoc(ref, { addedAt: new Date() });
      setWishlist([...wishlist, cafeId]);
    }
  };
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(null)
      );
    }
  }, []);
  const defaultCenter = userLocation || { lat: 37.5665, lng: 126.9780 };
  const matchingCafes = cafes.filter(cafe => cafe.flavor === userPreference);

  useEffect(() => {
    if (userPreference !== userPreferenceDefault) {
      setTodayCafe(getRandomElement(matchingCafes.length > 0 ? matchingCafes : cafes));
    } else {
      setTodayCafe(ssrTodayCafe);
    }
  }, [userPreference]);

  const todayMent = todayCafe
    ? `오늘은 ${weather}이에요. ${userPreference}한 분위기가 어울릴 것 같아요.\n&#39;${todayCafe.name}&#39;에서 감성 한 잔 어떠세요? ☕️`
    : "오늘의 추천 카페를 불러오는 중...";

  return (
    <main className="flex flex-col items-center min-h-screen pt-20 pb-20 bg-gradient-to-br from-amber-50 to-rose-100">
      <h1 className="text-2xl font-bold mb-4 text-espresso">📍 Firestore 기반 카페 리스트</h1>
      {/* 감성 챗봇 추천 멘트 + 추천 카페 카드 */}
      <div className="w-full max-w-2xl mb-6 flex flex-row items-start gap-4">
        <div className="flex flex-col items-start gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-mocha text-white px-3 py-1 text-lg font-bold shadow">{weatherEmoji}</div>
            <div className="bg-white/90 rounded-2xl px-4 py-3 shadow text-brown-700 font-serif text-base whitespace-pre-line">
              <div className="mb-1 text-xs text-mocha">오늘의 날씨: <span className="font-bold">{weather}</span> / 내 취향: <span className="font-bold">{userPreference}</span></div>
              {todayCafe ? (
                <>
                  오늘은 {weather}이에요. {userPreference}한 분위기가 어울릴 것 같아요.
                  <a
                    href={`https://map.kakao.com/link/map/${encodeURIComponent(todayCafe.name)},${todayCafe.lat},${todayCafe.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline font-bold text-espresso underline hover:text-mocha transition ml-1"
                  >
                    &#39;{todayCafe.name}&#39;
                  </a>
                  에서 감성 한 잔 어떠세요? ☕️
                </>
              ) : todayMent}
            </div>
          </div>
        </div>
      </div>
      {/* 내 취향(향미) 동적 선택 UI */}
      <div className="w-full max-w-md mb-2 flex items-center gap-2">
        <label htmlFor="flavor-select" className="text-sm font-bold text-mocha">내 취향:</label>
        <select
          id="flavor-select"
          value={userPreference}
          onChange={e => setUserPreference(e.target.value)}
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          {FLAVOR_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {userRecordCount === 0 ? (
          <a
            href="/record"
            className="ml-2 px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition"
          >
            취향분석하기
          </a>
        ) : null}
      </div>
      {/* 검색/정렬 UI */}
      <div className="flex flex-col md:flex-row gap-2 mb-4 w-full max-w-md">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && setSearch(e.currentTarget.value)}
            placeholder="카페명, 메뉴명 검색"
            className="flex-1 border border-mocha rounded-full px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-mocha font-serif text-sm"
          />
          <button
            onClick={() => setSearch(search)}
            className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold shadow transition"
          >
            검색
          </button>
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as "distance"|"name")}
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm focus:outline-none focus:ring-2 focus:ring-mocha"
        >
          <option value="distance">거리순</option>
          <option value="name">이름순</option>
        </select>
      </div>
      {/* 필터 드롭다운 UI */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setSelectedTag(null); setSelectedFlavor(null); }}
          className={`px-3 py-1 rounded-full border text-sm font-serif font-bold transition shadow ${!selectedTag && !selectedFlavor ? "bg-mocha text-black border-mocha" : "bg-caramel text-espresso border-mocha hover:bg-mocha hover:text-white"}`}
        >
          전체
        </button>
        <select
          value={selectedTag || ""}
          onChange={e => { setSelectedTag(e.target.value || null); setSelectedFlavor(null); }}
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm"
        >
          <option value="">분위기 태그</option>
          <option value="노트북 가능">💻 노트북 가능</option>
          <option value="조용함">🔇 조용함</option>
          <option value="채광 좋음">☀️ 채광 좋음</option>
          <option value="디저트 있음">🍰 디저트 있음</option>
          <option value="인스타 감성">📸 인스타 감성</option>
          <option value="로스터리">🔥 로스터리</option>
          <option value="테이스팅룸">🧑‍🔬 테이스팅룸</option>
          <option value="한옥">🏯 한옥</option>
          <option value="모던">🏢 모던</option>
          <option value="빈티지">📻 빈티지</option>
          <option value="공장 리모델링">🏭 공장 리모델링</option>
          <option value="포토존">📸 포토존</option>
          <option value="베이커리">🥐 베이커리</option>
          <option value="성당 느낌">⛪ 성당 느낌</option>
        </select>
        <select
          value={selectedFlavor || ""}
          onChange={e => { setSelectedFlavor(e.target.value || null); setSelectedTag(null); }}
          className="border border-mocha rounded-full px-3 py-2 bg-caramel text-espresso font-serif text-sm"
        >
          <option value="">맛 태그</option>
          <option value="Floral">Floral</option>
          <option value="Chocolate">Chocolate</option>
          <option value="Nutty">Nutty</option>
          <option value="Fruity">Fruity</option>
          <option value="Earthy">Earthy</option>
          <option value="Sweet">Sweet</option>
        </select>
      </div>
      {/* 지도 영역 */}
      <div style={{ position: "relative", width: "100%", height: 400, margin: "24px 0" }}>
        <GoogleMapView cafes={filteredCafes} center={mapCenter || defaultCenter} onMarkerClick={setSelectedCafe} />
        <button
          style={{ position: "absolute", top: 16, right: 16, zIndex: 10, background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer" }}
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                pos => {
                  setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                () => {
                  alert("위치 권한이 필요합니다.");
                }
              );
            } else {
              alert("위치 정보 사용이 불가합니다.");
            }
          }}
        >
          📌 내 위치로 이동
        </button>
      </div>
      {/* 카드 리스트 위에 안내 메시지 */}
      {pagedCafes.length === 0 && (
        <div className="w-full text-center text-red-500 font-bold my-4">
          {userPreference} 취향의 카페가 없습니다.
        </div>
      )}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedCafes.length > 0 ? pagedCafes.map((cafe) => (
          <div key={cafe.id} className="bg-white/80 rounded-2xl shadow p-4 flex flex-col gap-1 border border-caramel relative">
            {/* 찜 버튼 */}
            <button
              onClick={() => user ? toggleWishlist(cafe.id) : undefined}
              className={`absolute top-2 right-2 text-2xl z-10 ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={wishlist.includes(cafe.id) ? "찜 해제" : "찜하기"}
              disabled={!user}
              title={!user ? "로그인 후 이용 가능" : wishlist.includes(cafe.id) ? "찜 해제" : "찜하기"}
            >
              {wishlist.includes(cafe.id) ? "❤️" : "🤍"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-espresso">{cafe.name}</span>
              {userLocation && cafe.lat && cafe.lng && (
                <span className="text-xs text-blue-600 font-bold ml-1">{haversineDistance(userLocation.lat, userLocation.lng, cafe.lat, cafe.lng).toFixed(1)}km</span>
              )}
            </div>
            <div className="text-xs text-brown-700">{cafe.address}</div>
            <div className="text-xs text-mocha">대표 메뉴/향미: {cafe.menu} / <span className="font-bold">{cafe.flavor}</span></div>
            <div className="flex gap-2 mt-1">
              {cafe.tags?.map((tag: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-caramel text-xs text-espresso border border-mocha flex items-center gap-1">
                  {TAGS_ICON[tag] || "☕"} {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {cafe.signature_menu?.map((menu: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-mocha text-xs text-espresso border border-caramel flex items-center gap-1">
                  {MENU_ICON[menu as keyof typeof MENU_ICON] || "🍽️"} {menu}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {cafe.flavor_tags?.map((flavor: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-amber-100 text-xs text-espresso border border-mocha flex items-center gap-1">
                  {FLAVOR_ICON[flavor] || "☕"} {flavor}
                </span>
              ))}
              {cafe.flavor_main && (
                <span className="px-2 py-0.5 rounded-full bg-amber-300 text-xs text-espresso border border-mocha flex items-center gap-1 font-bold">
                  {FLAVOR_ICON[cafe.flavor_main] || "☕"} 대표: {cafe.flavor_main}
                </span>
              )}
            </div>
            {/* 지도 보기 버튼 */}
            <div className="flex gap-2 mt-2">
              <a
                href={`https://map.kakao.com/link/map/${encodeURIComponent(cafe.name)},${cafe.lat},${cafe.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-r from-blue-400 to-green-400 text-white text-sm font-bold shadow-lg border-2 border-blue-500 hover:from-blue-500 hover:to-green-500 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ minWidth: 110, justifyContent: 'center' }}
              >
                <span role="img" aria-label="지도">🗺️</span> 지도 보기
              </a>
            </div>
          </div>
        )) : (
          <div className="text-brown-400 text-center col-span-full">Firestore에서 불러온 카페가 없습니다.</div>
        )}
      </div>
      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={() => setPage(page-1)}
          disabled={page === 1}
          className="px-3 py-1 rounded bg-mocha text-white disabled:opacity-50"
        >이전</button>
        {Array.from({length: totalPages}, (_, i) => (
          <button
            key={i}
            onClick={() => setPage(i+1)}
            className={`px-3 py-1 rounded ${page === i+1 ? 'bg-espresso text-white' : 'bg-caramel text-espresso'}`}
          >{i+1}</button>
        ))}
        <button
          onClick={() => setPage(page+1)}
          disabled={page === totalPages}
          className="px-3 py-1 rounded bg-mocha text-white disabled:opacity-50"
        >다음</button>
      </div>
      {/* 카페 카드 클릭 시 상세 모달 */}
      {selectedCafe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedCafe(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-xl text-mocha hover:text-espresso font-bold"
              onClick={() => setSelectedCafe(null)}
            >
              ×
            </button>
            {selectedCafe.imageUrl && (
              <img src={selectedCafe.imageUrl} alt={selectedCafe.name} className="w-full h-40 object-cover rounded-xl mb-3" />
            )}
            <div className="text-2xl font-bold text-espresso mb-1">{selectedCafe.name}</div>
            <div className="flex items-center gap-2 mb-1">
              {selectedCafe.rating && (
                <span className="text-caramel font-bold text-lg">★ {selectedCafe.rating.toFixed(1)}</span>
              )}
              <span className="text-xs text-brown-700">{selectedCafe.address}</span>
            </div>
            <div className="text-xs text-mocha mb-2">대표 메뉴/향미: {selectedCafe.menu} / <span className="font-bold">{selectedCafe.flavor}</span></div>
            <div className="flex gap-2 mb-2">
              {selectedCafe.tags?.map((tag: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-caramel text-xs text-espresso border border-mocha flex items-center gap-1">
                  {TAGS_ICON[tag] || "☕"} {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {selectedCafe.signature_menu?.map((menu: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-mocha text-xs text-espresso border border-caramel flex items-center gap-1">
                  {MENU_ICON[menu as keyof typeof MENU_ICON] || "🍽️"} {menu}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {selectedCafe.flavor_tags?.map((flavor: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-amber-100 text-xs text-espresso border border-mocha flex items-center gap-1">
                  {FLAVOR_ICON[flavor] || "☕"} {flavor}
                </span>
              ))}
              {selectedCafe.flavor_main && (
                <span className="px-2 py-0.5 rounded-full bg-amber-300 text-xs text-espresso border border-mocha flex items-center gap-1 font-bold">
                  {FLAVOR_ICON[selectedCafe.flavor_main] || "☕"} 대표: {selectedCafe.flavor_main}
                </span>
              )}
            </div>
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(selectedCafe.name)},${selectedCafe.lat},${selectedCafe.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-3 py-2 rounded-full bg-mocha text-white text-sm font-bold shadow hover:bg-espresso transition mb-2"
            >
              지도에서 보기
            </a>
            {/* 샘플 리뷰 등 추가 가능 */}
          </div>
        </div>
      )}
    </main>
  );
} 