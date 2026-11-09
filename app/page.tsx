import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";
import MainPageHero, { type FeaturedBean } from "./components/MainPageHero";

export const metadata: Metadata = {
  description: "국내 로스터리의 실제 수집 원두를 사진으로 만나고 가격과 향미를 비교하세요.",
  alternates: { canonical: "/" },
};

function verifiedPhoto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function displayPrice(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value.toLocaleString("ko-KR")}원`;
  }
  if (typeof value !== "string" || !value.trim()) return "";
  return value.includes("원") ? value.trim() : `${value.trim()}원`;
}

// Cached 30 minutes: keep the image-led home grounded in the actual applied
// Firestore catalog without re-reading dozens of beans for every visitor.
const getFeaturedBeans = unstable_cache(async (): Promise<FeaturedBean[]> => {
  try {
    const snapshot = await getDocs(query(
      collection(db, "beans"), orderBy("lastUpdated", "desc"), limit(80)
    ));
    const seenBrands = new Set<string>();
    const featured: FeaturedBean[] = [];
    for (const item of snapshot.docs) {
      const row = item.data();
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const brand = typeof row.brand === "string" ? row.brand.trim() : "";
      const image = verifiedPhoto(row.image || row.image_url);
      if (!name || !brand || !image || row.isActive === false || row.active === false ||
        row.linkStatus === "dead" || row.isSample === true ||
        /정기배송|파우더|쿠폰|기프트카드|드립백/i.test(name) ||
        seenBrands.has(brand)) continue;
      featured.push({
        id: item.id, name, brand, image,
        price: displayPrice(row.price_krw ?? row.price),
      });
      seenBrands.add(brand);
      if (featured.length >= 3) break;
    }
    return featured;
  } catch (error) {
    console.error("Kinelo Coffee featured bean query failed", error);
    return [];
  }
}, ["kinelo-coffee-featured-beans-v1"], { revalidate: 1800 });

export default async function HomePage() {
  const featuredBeans = await getFeaturedBeans();
  return <MainPageHero featuredBeans={featuredBeans} />;
}
