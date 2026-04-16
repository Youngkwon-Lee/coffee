import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function heuristicExtract(text: string, confidence = 0.4) {
  const t = text || '';

  // OCR 오탈자/축약 보정
  const normalized = t
    .replace(/CHOCOLAT\b/gi, 'CHOCOLATE')
    .replace(/MACATAMA\b/gi, 'MACADAMIA')
    .replace(/BLENDlNG/gi, 'BLENDING')
    .replace(/\|/g, '\n');

  const lower = normalized.toLowerCase();

  const cafeHints = ['센터커피','테라로사','프릳츠','프리츠','모모스','로우키','엘카페','보난자','나무사이로','딥블루레이크'];
  const processingHints = ['Natural','Washed','Honey','Semi-Washed','Anaerobic','Carbonic'];

  let cafe = '';
  for (const c of cafeHints) {
    if (normalized.includes(c)) { cafe = c; break; }
  }

  let processing = '';
  for (const p of processingHints) {
    if (new RegExp(p, 'i').test(normalized)) { processing = p; break; }
  }

  const flavorHints: Array<[string, RegExp]> = [
    ['초콜릿', /(초콜릿|chocolate|dark\s*chocolate|cacao|cocoa)/i],
    ['견과류', /(견과|nut|macadamia|almond|hazelnut|pecan|walnut)/i],
    ['베리', /(베리|berry|berries|blueberry|raspberry|strawberry)/i],
    ['시트러스', /(시트러스|citrus|orange|lemon|grapefruit)/i],
    ['카라멜', /(카라멜|caramel|toffee|butterscotch)/i],
    ['플로럴', /(플로럴|floral|jasmine|flower)/i],
    ['과일', /(과일|fruit|fruity|plum|peach|apple|grape)/i],
    ['꿀', /(꿀|honey)/i],
  ];
  const flavor = flavorHints.filter(([, re]) => re.test(normalized)).map(([name]) => name).slice(0, 6);

  const lines = normalized.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  let bean = '';

  // 1) 일반적인 원두 라인 탐색
  for (const ln of lines) {
    if (/원두|bean|blend|blending|에티오피아|콜롬비아|케냐|과테말라|브라질/i.test(ln) && ln.length <= 80) {
      bean = ln;
      break;
    }
  }

  // 2) BLENDING 단독 인식 보정: 라인 기반으로 브랜드/블렌드명 복원
  if (!bean || /^blending$/i.test(bean) || /^blend$/i.test(bean)) {
    const upperLines = lines.map((l) => l.toUpperCase());
    const blendIdx = upperLines.findIndex((l) => /\bBLENDING\b|\bBLEND\b/.test(l));

    const isNoiseLine = (l: string) => /\b(TYPE|ROAST|REGION|NET|WT|WHOLE BEAN|QUALITY|ROASTED BY)\b/.test(l);
    const isFlavorLine = (l: string) => /\b(CARAMEL|CHOCOLAT|CHOCOLATE|BERRY|CITRUS|FLORAL|PLUM|MACADAMIA|NUT)\b/.test(l);

    if (blendIdx >= 0) {
      let title = '';
      for (let i = blendIdx - 1; i >= 0; i--) {
        const cand = upperLines[i].trim();
        if (!cand || isNoiseLine(cand) || isFlavorLine(cand)) continue;
        if (cand.split(' ').length >= 2 && cand.length <= 40) {
          title = cand;
          break;
        }
      }
      if (title) {
        bean = `${title} BLENDING`.trim();
      }
    }

    // 라인 기반에서 못 찾으면 토큰 기반 fallback
    if (!bean) {
      const tokens = (normalized.match(/[A-Za-z]{2,}/g) || []).map((x) => x.toUpperCase());
      const idx = tokens.findIndex((x) => x === 'BLENDING' || x === 'BLEND');
      if (idx >= 1) {
        const start = Math.max(0, idx - 3);
        const candidate = tokens.slice(start, idx + 1).join(' ').trim();
        if (candidate.split(' ').length >= 2) {
          bean = candidate;
        }
      }
    }
  }

  // 3) 여전히 비어있으면 문장 내 키워드 기반 fallback
  if (!bean && /(blending|blend|single origin|ethiopia|colombia|kenya|guatemala|brazil)/i.test(lower)) {
    bean = (normalized.split(/\n|\.|\|/).find((s) => /(blending|blend|single origin|ethiopia|colombia|kenya|guatemala|brazil)/i.test(s)) || '').trim();
  }

  return {
    cafe,
    bean,
    processing,
    flavor,
    confidence,
    raw_text: text,
    llm_response: '',
    source: 'heuristic-fallback',
  };
}

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let inputText = '';
  let inputConfidence: number | undefined = undefined;

  try {
    const { text, confidence } = await request.json();
    inputText = text || '';
    inputConfidence = confidence;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // LLM 프롬프트 구성
    const prompt = `
다음은 커피백이나 메뉴판에서 추출된 텍스트입니다. 한국의 커피 문화에 맞춰 정확한 정보를 추출해주세요.

추출된 텍스트:
${text}

다음 형태의 JSON으로 응답해주세요:
{
  "cafe": "카페명 (로스터리나 커피숍 이름)",
  "bean": "원두명 (완전한 원두 제품명)",
  "processing": "가공방식",
  "flavor": ["향미1", "향미2", "향미3"]
}

추출 규칙:
1. 카페명 (cafe):
   - 실제 커피숍/로스터리 이름만 (예: "센터커피", "테라로사", "프릳츠커피")
   - 원산지명(에티오피아, 콜롬비아 등)은 카페명이 아님
   - 농장명(예: 예가체프, 안티구아)도 카페명이 아님
   - 확실하지 않으면 빈 문자열 ""

2. 원두명 (bean):
   - 완전한 제품명 (예: "에티오피아 예가체프 G1", "콜롬비아 수프레모")
   - 원산지 + 등급/농장명 포함
   - 단순히 "아메리카노"나 "에스프레소"는 원두명이 아님

3. 가공방식 (processing):
   - Natural, Washed, Honey, Semi-Washed, Anaerobic, Carbonic 중 하나
   - 확실하지 않으면 빈 문자열 ""

4. 향미 (flavor):
   - 구체적인 향미만 (예: ["초콜릿", "견과류", "베리"])
   - 최대 5개까지
   - "달콤함", "산미" 같은 추상적 표현 제외

반드시 유효한 JSON만 반환하세요. 설명이나 추가 텍스트는 포함하지 마세요.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 커피 전문가입니다. 텍스트에서 커피 관련 정보를 정확하게 추출하여 JSON 형태로 반환합니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    try {
      // JSON 파싱 시도
      const extractedData = JSON.parse(responseText);
      
      // 기본값 설정
      const result = {
        cafe: extractedData.cafe || '',
        bean: extractedData.bean || '',
        processing: extractedData.processing || '',
        flavor: Array.isArray(extractedData.flavor) ? extractedData.flavor : [],
        confidence: confidence || 0.8,
        raw_text: text,
        llm_response: responseText
      };

      return NextResponse.json(result);

    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      
      // JSON 파싱 실패 시 기본값 반환
      const fallbackResult = {
        cafe: '',
        bean: '',
        processing: '',
        flavor: [],
        confidence: 0.5,
        raw_text: text,
        llm_response: responseText,
        error: 'Failed to parse LLM response as JSON'
      };

      return NextResponse.json(fallbackResult);
    }

  } catch (error) {
    console.error('LLM extraction error:', error);

    // OpenAI 실패 시 휴리스틱 폴백 (서비스 중단 방지)
    const fallback = heuristicExtract(inputText, inputConfidence || 0.4);
    return NextResponse.json({
      ...fallback,
      error: 'LLM extraction failed; fallback used',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET 메서드는 지원하지 않음
export async function GET() {
  return NextResponse.json(
    { error: 'POST 메서드만 지원됩니다.' },
    { status: 405 }
  );
} 