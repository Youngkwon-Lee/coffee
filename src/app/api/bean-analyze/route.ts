import { NextRequest, NextResponse } from 'next/server';
import vision from '@google-cloud/vision';
import beans from '@/data/beansList_sample.json';

export const runtime = 'nodejs';

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Bean 타입 정의
interface Bean {
  name: string;
  brand: string;
  flavors?: string[];
}

// 문자열 전처리(소문자, 특수문자/공백 제거)
function normalize(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/gi, "");
}

// name, brand, name의 각 단어까지 부분 매칭 점수 합산
function findBestBean(text: string) {
  const normText = normalize(text);
  let best = null;
  let maxScore = 0;
  for (const bean of beans as Bean[]) {
    const normName = normalize(bean.name);
    const normBrand = normalize(bean.brand);
    let score = 0;
    if (normText.includes(normName)) score += normName.length * 2;
    if (normText.includes(normBrand)) score += normBrand.length;
    // name의 각 단어가 포함되어 있으면 가산점
    for (const word of normName.split(/\s+/)) {
      if (word.length > 2 && normText.includes(word)) score += word.length;
    }
    if (score > maxScore) {
      best = bean;
      maxScore = score;
    }
  }
  return best;
}

// OCR 텍스트에서 향미(flavor) 추출 (영문/한글)
function extractFlavors(text: string) {
  // 영문 flavor: Bergamot, Nectarine, ...
  const engMatch = text.match(/[Bb]ergamot,[^\n]*/);
  // 한글 flavor: 향미[:：]?\s*([가-힣,·\s]+)
  const korMatch = text.match(/향미[:：]?\s*([가-힣,·\s]+)/);
  let flavors: string[] = [];
  if (engMatch) flavors = engMatch[0].split(/,|and/).map(f => f.trim());
  if (korMatch) flavors = korMatch[1].split(/,|·/).map(f => f.trim());
  return flavors.filter(f => f.length > 1);
}

// OCR 텍스트에서 카페명 추출 (예: HYANGMISA, Fritz 등 대문자+영문/한글 한 단어)
function extractCafe(text: string) {
  // 대문자+영문, 한글 단어 중 6자 이상
  const cafeMatch = text.match(/[A-Z가-힣]{4,}/g);
  if (cafeMatch) return cafeMatch[0];
  return null;
}

// OCR 텍스트에서 원두명 추출 (에티오피아, 콜롬비아 등 주요 산지명 포함된 한글/영문 라인)
function extractBean(text: string) {
  // 한글/영문 주요 산지명
  const origins = [
    '에티오피아', '콜롬비아', '케냐', '브라질', '예멘', '과테말라', '파나마',
    'Ethiopia', 'Colombia', 'Kenya', 'Brazil', 'Yemen', 'Guatemala', 'Panama'
  ];
  const lines = text.split(/\n|\r/);
  for (const line of lines) {
    for (const o of origins) {
      if (line.includes(o) && line.length < 40) return line.trim();
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Vision API로 이미지 분석
  const [result] = await client.textDetection({ image: { content: buffer } });
  const text = result.fullTextAnnotation?.text || "";

  // beans DB에서 가장 유사한 원두 찾기
  const bestBean = findBestBean(text);

  if (bestBean) {
    return NextResponse.json({
      bean: bestBean.name,
      cafe: bestBean.brand,
      flavor: bestBean.flavors,
      raw_text: text
    });
  } else {
    // beans DB 매칭 실패 시 OCR 텍스트에서 직접 추출
    const bean = extractBean(text);
    const cafe = extractCafe(text);
    const flavor = extractFlavors(text);
    return NextResponse.json({
      bean,
      cafe,
      flavor,
      raw_text: text
    });
  }
} 