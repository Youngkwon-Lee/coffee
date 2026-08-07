import type { MetadataRoute } from "next";

const SITE_URL = "https://coffee-omega-lovat.vercel.app";
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coffee-37b81";

/**
 * beans/cafes는 firestore.rules에서 공개 읽기(`allow read: if true`)라
 * Admin SDK 없이 REST로 읽는다. 서비스 계정을 서버 번들에 넣지 않아도 된다.
 */
async function fetchIds(collection: string): Promise<{ id: string; updated?: string }[]> {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const out: { id: string; updated?: string }[] = [];
  let pageToken: string | undefined;

  // 페이지네이션. 원두가 300개를 넘어가면 다음 페이지가 생긴다.
  for (let page = 0; page < 5; page++) {
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) break;
    const json = (await res.json()) as {
      documents?: { name: string; updateTime?: string }[];
      nextPageToken?: string;
    };
    for (const d of json.documents ?? []) {
      out.push({ id: d.name.split("/").pop() as string, updated: d.updateTime });
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/beans`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cafes`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/record/manual`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  // 원두·카페 상세 페이지. 검색 유입은 개별 원두 이름으로 들어오므로
  // 목록 페이지만 색인시키면 "프릳츠 원두 재입고" 같은 질의에 닿지 않는다.
  try {
    const [beans, cafes] = await Promise.all([fetchIds("beans"), fetchIds("cafes")]);
    return [
      ...staticPages,
      ...beans.map((b) => ({
        url: `${SITE_URL}/beans/${encodeURIComponent(b.id)}`,
        lastModified: b.updated ? new Date(b.updated) : now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...cafes.map((c) => ({
        url: `${SITE_URL}/cafes/${encodeURIComponent(c.id)}`,
        lastModified: c.updated ? new Date(c.updated) : now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // Firestore를 못 읽어도 정적 페이지만이라도 색인되게 한다.
    return staticPages;
  }
}
