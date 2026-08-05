import { NextRequest, NextResponse } from "next/server";

/**
 * Google Places 사진 프록시.
 *
 * 왜 URL을 Firestore에 저장하지 않는가:
 * Places 정책은 "must not pre-fetch, cache, or store Places API content"이고,
 * 무기한 저장이 허용되는 건 place_id 하나뿐이다. 사진 리소스 이름(name)도 만료되어
 * 저장해두면 언젠가 깨진다. 그래서 place_id만 문서에 담고, 표시 시점에 여기서
 * 사진을 받아 넘긴다.
 *
 * 키가 없으면 404를 반환하고, 호출부는 기존 폴백 이미지를 계속 쓴다.
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

type PhotoInfo = {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
};

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  const maxWidth = Number(request.nextUrl.searchParams.get("w") || 800);

  if (!API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY 미설정" },
      { status: 404 }
    );
  }
  if (!placeId) {
    return NextResponse.json({ error: "placeId 필요" }, { status: 400 });
  }

  try {
    // 1) Place Details에서 사진 리소스 이름을 받는다. 이름은 만료되므로 매번 새로 받는다.
    const detailRes = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "photos,googleMapsUri",
      },
      // 사진 메타데이터는 저장하지 않는다.
      cache: "no-store",
    });

    if (!detailRes.ok) {
      return NextResponse.json(
        { error: `place details 실패 (${detailRes.status})` },
        { status: 502 }
      );
    }

    const detail = (await detailRes.json()) as {
      photos?: PhotoInfo[];
      googleMapsUri?: string;
    };
    const photo = detail.photos?.[0];
    if (!photo?.name) {
      return NextResponse.json({ error: "사진 없음" }, { status: 404 });
    }

    // 2) 실제 이미지 URL을 받는다(skipHttpRedirect로 JSON 응답).
    const mediaRes = await fetch(
      `https://places.googleapis.com/v1/${photo.name}/media` +
        `?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${API_KEY}`,
      { cache: "no-store" }
    );

    if (!mediaRes.ok) {
      return NextResponse.json(
        { error: `photo media 실패 (${mediaRes.status})` },
        { status: 502 }
      );
    }

    const media = (await mediaRes.json()) as { photoUri?: string };
    if (!media.photoUri) {
      return NextResponse.json({ error: "photoUri 없음" }, { status: 404 });
    }

    // 저작자 표시는 정책상 필수다. 호출부가 화면에 함께 노출해야 한다.
    return NextResponse.json(
      {
        photoUri: media.photoUri,
        attributions: photo.authorAttributions ?? [],
        googleMapsUri: detail.googleMapsUri ?? null,
      },
      {
        // 짧은 브라우저 캐시만 허용한다. 장기 저장은 정책 위반이다.
        headers: { "Cache-Control": "private, max-age=1800" },
      }
    );
  } catch (error) {
    console.error("cafe-photo 실패:", error);
    return NextResponse.json({ error: "내부 오류" }, { status: 500 });
  }
}
