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
    return NextResponse.json({
      bean: null,
      cafe: null,
      flavor: null,
      raw_text: text
    });
  }
} 