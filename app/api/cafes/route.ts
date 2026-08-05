import { NextResponse } from "next/server";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/firebase";
import { buildCafeAliases, fallbackCafeMetadata } from "@/data/cafeMetadataCatalog";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getDocs(query(collection(db, "cafes"), limit(300)));
    const cafes = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const lat = Number(data.lat);
        const lng = Number(data.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !data.name || !data.address) {
          return null;
        }

        return {
          id: doc.id,
          name: String(data.name),
          address: String(data.address),
          lat,
          lng,
          aliases: Array.isArray(data.aliases)
            ? data.aliases.map((alias: unknown) => String(alias))
            : buildCafeAliases(String(data.name), typeof data.website === "string" ? data.website : undefined),
        };
      })
      .filter(Boolean);

    if (cafes.length === 0) {
      return NextResponse.json({ cafes: fallbackCafeMetadata, source: "fallback" });
    }

    return NextResponse.json({ cafes });
  } catch (error) {
    return NextResponse.json({
      cafes: fallbackCafeMetadata,
      source: "fallback",
      warning: "카페 목록을 불러오지 못해 로컬 메타데이터를 사용합니다.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
