import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(req: NextRequest) {
  try {
    // API 키가 없으면 기본 매핑 반환
    if (!openai) {
      return NextResponse.json({
        flavor: 'Unknown',
        confidence: 0,
        error: 'OpenAI API key not configured'
      });
    }

    const { text, availableFlavors, existingFlavors } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const prompt = `
커피 원두 패키지에서 추출된 다음 텍스트를 분석하여, 표준 향미 카테고리로 매핑해주세요.

추출된 텍스트: "${text}"

사용 가능한 표준 향미 카테고리:
${availableFlavors.join(', ')}

이미 매핑된 향미: ${existingFlavors.length > 0 ? existingFlavors.join(', ') : '없음'}

지침:
1. 텍스트에서 향미와 관련된 단어/구문을 찾아 표준 카테고리로 매핑
2. 이미 매핑된 향미는 제외
3. Chocolate-like나 Nutty에만 의존하지 말고 다양한 향미를 고려할 것
4. 과일, 꽃, 허브, 산미 관련 단어들을 우선적으로 찾아볼 것
5. 최대 5개까지만 선택
6. 확실하지 않은 경우에는 포함하지 않음
7. JSON 배열 형태로만 응답 (설명 없이)

한국어 향미 힌트:
- 레몬, 오렌지, 자몽, 시트러스 → Citrus
- 꽃향기, 플로럴, 장미, 자스민 → Floral  
- 과일, 베리, 딸기, 블루베리 → Berry-like, Fruity
- 허브, 민트, 로즈마리 → Herby
- 신맛, 산미, 새콤 → Acidic, Sour
- 달콤함, 시럽 → Sweet, Syrup-like
- 바닐라 → Vanilla-like
- 카라멜 → Caramel
- 흙, 나무 → Earthy
- 연기, 구수함 → Smoky

예시:
- "블러드 오렌지, 체리" → ["Citrus", "Berry-like"] 
- "꽃향기와 과일향" → ["Floral", "Fruity"]
- "민트와 허브" → ["Herby"]
- "신맛과 달콤함" → ["Acidic", "Sweet"]
- "바닐라 향" → ["Vanilla-like"]

응답 형식: ["향미1", "향미2", ...]
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 커피 향미 전문가입니다. 텍스트에서 향미를 분석하여 표준 카테고리로 매핑하는 작업을 수행합니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    if (!response) {
      return NextResponse.json({ flavors: [] });
    }

    try {
      // JSON 파싱 시도
      const flavors = JSON.parse(response);
      
      // 유효성 검증
      if (!Array.isArray(flavors)) {
        return NextResponse.json({ flavors: [] });
      }

      // 사용 가능한 향미만 필터링
      const validFlavors = flavors.filter((flavor: string) => 
        availableFlavors.includes(flavor) && !existingFlavors.includes(flavor)
      );

      return NextResponse.json({ 
        flavors: validFlavors.slice(0, 5) // 최대 5개
      });

    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return NextResponse.json({ flavors: [] });
    }

  } catch (error) {
    console.error('GPT 향미 매핑 오류:', error);
    return NextResponse.json({ 
      error: 'GPT 분석 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 