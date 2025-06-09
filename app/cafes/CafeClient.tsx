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
      {/* 🎨 현대적인 헤더 섹션 */}
      <div className="w-full max-w-7xl mb-8">
        {/* 페이지 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-4">
            📍 우리 동네 카페 찾기
          </h1>
          <p className="text-gray-600 text-lg">취향에 맞는 완벽한 카페를 발견하세요</p>
        </div>

        {/* AI 추천 카드 */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl p-6 mb-8 shadow-lg border border-amber-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 flex items-center justify-center text-3xl shadow-lg">
              {weatherEmoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-sm">
                  오늘의 날씨: <span className="font-bold text-blue-600">{weather}</span>
                </span>
                <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-sm">
                  내 취향: <span className="font-bold text-amber-600">{userPreference}</span>
                </span>
              </div>
              <div className="text-gray-700 text-lg">
                {todayCafe ? (
                  <>
                    오늘은 <span className="font-semibold">{weather}</span> 날씨에 <span className="font-semibold text-amber-600">{userPreference}</span>한 분위기가 어울려요.
                    <a
                      href={`https://map.kakao.com/link/map/${encodeURIComponent(todayCafe.name)},${todayCafe.lat},${todayCafe.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                      <span className="font-bold">{todayCafe.name}</span> 🗺️
                    </a>
                    에서 감성 한 잔 어떠세요? ☕
                  </>
                ) : (
                  todayMent
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 섹션 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          {/* 취향 선택 */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-800 mb-3">🎯 내 취향</label>
            <div className="flex flex-wrap gap-3 items-center">
              {FLAVOR_OPTIONS.map(flavor => (
                <button
                  key={flavor}
                  onClick={() => setUserPreference(flavor)}
                  className={`px-4 py-2 rounded-full font-medium transition-all duration-300 ${
                    userPreference === flavor
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }`}
                >
                  {flavor}
                </button>
              ))}
              {userRecordCount === 0 && (
                <a
                  href="/record"
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  ✨ 취향 분석하기
                </a>
              )}
            </div>
          </div>

          {/* 검색바 */}
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-800 mb-3">🔍 검색</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && setSearch(e.currentTarget.value)}
                  placeholder="카페명, 메뉴명을 검색해보세요..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-amber-400 focus:outline-none transition-all duration-300 text-lg"
                />
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">🔍</span>
              </div>
              <button
                onClick={() => setSearch(search)}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                검색
              </button>
            </div>
          </div>

          {/* 필터 및 정렬 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">정렬</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as "distance"|"name")}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none transition-all duration-300"
              >
                <option value="distance">📍 거리순</option>
                <option value="name">📝 이름순</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">분위기</label>
              <select
                value={selectedTag || ""}
                onChange={e => { setSelectedTag(e.target.value || null); setSelectedFlavor(null); }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none transition-all duration-300"
              >
                <option value="">🏠 전체 분위기</option>
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
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">향미</label>
              <select
                value={selectedFlavor || ""}
                onChange={e => { setSelectedFlavor(e.target.value || null); setSelectedTag(null); }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none transition-all duration-300"
              >
                <option value="">☕ 전체 향미</option>
                <option value="Floral">🌸 Floral</option>
                <option value="Chocolate">🍫 Chocolate</option>
                <option value="Nutty">🥜 Nutty</option>
                <option value="Fruity">🍓 Fruity</option>
                <option value="Earthy">🌿 Earthy</option>
                <option value="Sweet">🍯 Sweet</option>
              </select>
            </div>
          </div>

          {/* 필터 초기화 버튼 */}
          <div className="flex justify-center">
            <button
              onClick={() => { 
                setSelectedTag(null); 
                setSelectedFlavor(null); 
                setSearch("");
              }}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-medium hover:bg-gray-200 transition-all duration-300"
            >
              🔄 필터 초기화
            </button>
          </div>
        </div>
      </div>
      {/* 🗺️ 현대적인 지도 섹션 */}
      <div className="w-full max-w-7xl mb-8">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              🗺️ 카페 위치 보기
            </h2>
            <button
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
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              📌 내 위치로 이동
            </button>
          </div>
          <div className="relative w-full h-96 rounded-2xl overflow-hidden shadow-lg">
            <GoogleMapView cafes={filteredCafes} center={mapCenter || defaultCenter} onMarkerClick={setSelectedCafe} />
          </div>
        </div>
      </div>
      {/* 카드 리스트 위에 안내 메시지 */}
      {pagedCafes.length === 0 && (
        <div className="w-full text-center text-red-500 font-bold my-4">
          {userPreference} 취향의 카페가 없습니다.
        </div>
      )}
      <div className="w-full max-w-6xl">
        {pagedCafes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedCafes.map((cafe) => (
              <div key={cafe.id} className="group relative">
                {/* 메인 카드 */}
                <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:-translate-y-2">
                  {/* 카페 이미지 영역 */}
                  <div className="relative h-64 bg-gradient-to-br from-amber-100 via-orange-100 to-red-100 overflow-hidden">
                    {cafe.imageUrl ? (
                      <img 
                        src={cafe.imageUrl} 
                        alt={cafe.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-6xl mb-2 block">☕</span>
                          <p className="text-gray-500 text-sm">{cafe.name}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* 찜 버튼 */}
                    <button
                      onClick={() => user ? toggleWishlist(cafe.id) : undefined}
                      className={`absolute top-4 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!user}
                    >
                      <span className="text-xl">
                        {wishlist.includes(cafe.id) ? "❤️" : "🤍"}
                      </span>
                    </button>

                    {/* 거리 표시 */}
                    {userLocation && cafe.lat && cafe.lng && (
                      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                        📍 {haversineDistance(userLocation.lat, userLocation.lng, cafe.lat, cafe.lng).toFixed(1)}km
                      </div>
                    )}

                    {/* 평점 배지 */}
                    {cafe.rating && (
                      <div className="absolute bottom-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        ⭐ {cafe.rating.toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* 카페 정보 영역 */}
                  <div className="p-6">
                    {/* 카페명과 주소 */}
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-amber-600 transition-colors">
                        {cafe.name}
                      </h3>
                      <p className="text-gray-600 text-sm flex items-center">
                        <span className="mr-2">📍</span>
                        {cafe.address}
                      </p>
                    </div>

                    {/* 대표 메뉴 */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">대표 메뉴</p>
                      <div className="flex flex-wrap gap-2">
                        {cafe.signature_menu?.slice(0, 3).map((menu: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-gradient-to-r from-coffee-100 to-amber-100 text-coffee-700 rounded-full text-xs font-medium border border-coffee-200">
                            {MENU_ICON[menu as keyof typeof MENU_ICON] || "🍽️"} {menu}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 향미 태그 */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">향미</p>
                      <div className="flex flex-wrap gap-2">
                        {cafe.flavor_main && (
                          <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full text-xs font-bold shadow-md">
                            {FLAVOR_ICON[cafe.flavor_main] || "☕"} {cafe.flavor_main}
                          </span>
                        )}
                        {cafe.flavor_tags?.slice(0, 2).map((flavor: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                            {FLAVOR_ICON[flavor] || "☕"} {flavor}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 특징 태그 */}
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {cafe.tags?.slice(0, 4).map((tag: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200 hover:bg-gray-200 transition-colors">
                            {TAGS_ICON[tag] || "☕"} {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-3">
                      <a
                        href={`https://map.kakao.com/link/map/${encodeURIComponent(cafe.name)},${cafe.lat},${cafe.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        <span>🗺️</span>
                        지도에서 보기
                      </a>
                      <button
                        onClick={() => setSelectedCafe(cafe)}
                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                      >
                        <span>ℹ️</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">카페를 찾을 수 없어요</h3>
            <p className="text-gray-600 mb-8">다른 조건으로 검색해보세요</p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedTag(null);
                setSelectedFlavor(null);
              }}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-center items-center gap-3 mt-12">
        <button
          onClick={() => setPage(page-1)}
          disabled={page === 1}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          <span>←</span> 이전
        </button>
        
        <div className="flex gap-2">
          {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-10 h-10 rounded-full font-medium transition-all duration-300 ${
                  page === pageNum 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => setPage(page+1)}
          disabled={page === totalPages}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          다음 <span>→</span>
        </button>
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