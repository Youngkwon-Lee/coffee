export const dynamic = 'force-dynamic';

import CafeClient from './CafeClient';
import type { Cafe } from "./CafeClient";
import { db } from "../../src/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

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
  const cafeSnap = await getDocs(query(collection(db, "cafes"), limit(50)));

  return cafeSnap.docs.map(doc => {
    const data = doc.data();

    const convertTimestamp = (timestamp: any) => {
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        return timestamp.toDate().toISOString();
      }
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      return timestamp || null;
    };

    const crawlConfig = data.crawlConfig ? {
      ...data.crawlConfig,
      lastCrawled: convertTimestamp(data.crawlConfig.lastCrawled)
    } : undefined;

    return {
      id: doc.id,
      ...data,
      imageUrl: data.imageUrl || data.image || "",
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

export default async function CafesPage() {
  const [weather, cafes] = await Promise.all([
    getWeather(),
    getCafes()
  ]);

  const main: string = weather?.weather?.[0]?.main || "알 수 없음";
  const todayWeather = WEATHER_MAP[main] || "알 수 없음";
  const weatherEmoji = WEATHER_EMOJI[todayWeather] || "❔";

  const userPreferenceDefault = "Floral";
  const todayCafe = getRandomElement(cafes);

  return <CafeClient
    weather={todayWeather}
    weatherEmoji={weatherEmoji}
    cafes={cafes}
    todayCafe={todayCafe}
    userPreferenceDefault={userPreferenceDefault}
  />;
}
