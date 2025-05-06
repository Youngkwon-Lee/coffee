import CafeClient from "./CafeClient";
import type { Cafe } from "./CafeClient";

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

// Firestore에서 cafes 데이터 fetch (서버 컴포넌트에서)
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

async function getCafes(): Promise<Cafe[]> {
  const snap = await getDocs(collection(db, "cafes"));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cafe));
}

function getRandomElement<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export default async function CafesPage() {
  const weather = await getWeather();
  const main: string = weather?.weather?.[0]?.main || "알 수 없음";
  const todayWeather = WEATHER_MAP[main] || "알 수 없음";
  const weatherEmoji = WEATHER_EMOJI[todayWeather] || "❔";
  const cafes = await getCafes();
  const userPreferenceDefault = "Floral";
  const matchingCafes = cafes.filter(cafe => cafe.flavor === userPreferenceDefault);
  const todayCafe = getRandomElement(matchingCafes.length > 0 ? matchingCafes : cafes);
  return <CafeClient weather={todayWeather} weatherEmoji={weatherEmoji} cafes={cafes} todayCafe={todayCafe} userPreferenceDefault={userPreferenceDefault} />;
} 