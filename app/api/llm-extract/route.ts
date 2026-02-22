import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  try {
    const { text, confidence } = await request.json();

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
    return NextResponse.json(
      { 
        error: 'LLM extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET 메서드는 지원하지 않음
export async function GET() {
  return NextResponse.json(
    { error: 'POST 메서드만 지원됩니다.' },
    { status: 405 }
  );
} 