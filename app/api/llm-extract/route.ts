import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
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
다음은 커피백이나 메뉴판에서 추출된 텍스트입니다. 이 텍스트에서 커피 관련 정보를 추출해서 JSON 형태로 반환해주세요.

추출된 텍스트:
${text}

다음 형태의 JSON으로 응답해주세요:
{
  "cafe": "카페명 (실제 커피숍 이름, 원산지나 농장명이 아닌)",
  "bean": "원두명 (원산지 + 지역/농장명 포함)",
  "processing": "가공방식 (Natural, Washed, Honey, Anaerobic 등)",
  "flavor": ["향미1", "향미2", "향미3"]
}

주의사항:
- 카페명은 실제 커피숍 이름이어야 합니다 (원산지명이나 농장명은 카페명이 아닙니다)
- 원두명에는 원산지와 농장/지역명을 포함해주세요
- 향미는 배열로 반환하되, 최대 5개까지만 추출해주세요
- 확실하지 않은 정보는 빈 문자열이나 빈 배열로 반환해주세요
- 반드시 유효한 JSON 형태로 응답해주세요
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