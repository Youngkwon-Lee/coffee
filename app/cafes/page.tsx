import CafeClient from "./CafeClient";
import type { Cafe } from "./CafeClient";
import { db } from "@/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { auth } from "@/firebase";

const WEATHER_MAP: { [key: string]: string } = {
  Clear: "맑음",
  Clouds: "흐림",
  Rain: "비",
  Snow: "눈",
  Mist: "안개",
  Drizzle: "이슬비",
  Thunderstorm: "뇌우"
};
const WEATHER_EMOJI: { [key: string]: string } = {
  "맑음": "☀️",
  "흐림": "☁️",
  "비": "🌧️",
  "눈": "❄️",
  "안개": "🌫️",
  "이슬비": "🌦️",
  "뇌우": "⛈️",
  "알 수 없음": "❔",
  "로딩중...": "⏳",
  "위치 정보 없음": "❔",
  "위치 미지원": "❔",
  "API키 없음": "❔",
  "날씨 불러오기 실패": "❔"
};

export const revalidate = 10800;

async function getWeather() {
  const lat = 37.5665;
  const lon = 126.9780;
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&lang=kr&units=metric`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function getCafes(): Promise<Cafe[]> {
  const snap = await getDocs(collection(db, "cafes"));
  return snap.docs.map(doc => {
    const data = doc.data();
    
    // Timestamp 객체들을 안전하게 문자열로 변환
    const convertTimestamp = (timestamp: any) => {
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        return timestamp.toDate().toISOString();
      }
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      return timestamp || null;
    };

    // crawlConfig 내의 timestamp 처리
    const crawlConfig = data.crawlConfig ? {
      ...data.crawlConfig,
      lastCrawled: convertTimestamp(data.crawlConfig.lastCrawled)
    } : undefined;

    return {
      id: doc.id,
      ...data,
      crawlConfig,
      createdAt: convertTimestamp(data.createdAt),
      lastUpdated: convertTimestamp(data.lastUpdated)
    } as Cafe;
  });
}

function getRandomElement<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function getUserPreference(userId: string) {
  try {
    const q = query(
      collection(db, `users/${userId}/records`),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    const records = snap.docs.map(doc => doc.data());
    
    // 향미 빈도수 계산
    const flavorCount: { [key: string]: number } = {};
    records.forEach(record => {
      if (record.flavor && Array.isArray(record.flavor)) {
        record.flavor.forEach((f: string) => {
          flavorCount[f] = (flavorCount[f] || 0) + 1;
        });
      }
    });
    
    // 가장 많이 선택된 향미 반환
    const sortedFlavors = Object.entries(flavorCount)
      .sort(([,a], [,b]) => b - a);
    
    return sortedFlavors.length > 0 ? sortedFlavors[0][0] : "Floral";
  } catch (error) {
    console.error("Error fetching user preference:", error);
    return "Floral";
  }
}

export default async function CafesPage() {
  const weather = await getWeather();
  const main: string = weather?.weather?.[0]?.main || "알 수 없음";
  const todayWeather = WEATHER_MAP[main] || "알 수 없음";
  const weatherEmoji = WEATHER_EMOJI[todayWeather] || "❔";
  const cafes = await getCafes();
  
  // 사용자 취향 가져오기
  let userPreferenceDefault = "Floral";
  const currentUser = auth.currentUser;
  
  if (currentUser) {
    userPreferenceDefault = await getUserPreference(currentUser.uid);
  }
  
  const matchingCafes = cafes.filter(cafe => cafe.flavor === userPreferenceDefault);
  const todayCafe = getRandomElement(matchingCafes.length > 0 ? matchingCafes : cafes);
  
  return <CafeClient 
    weather={todayWeather} 
    weatherEmoji={weatherEmoji} 
    cafes={cafes} 
    todayCafe={todayCafe} 
    userPreferenceDefault={userPreferenceDefault}
  />;
} 