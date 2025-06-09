import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

type Bean = {
  name: string;
  flavor: string | string[];
  roast?: string;
  brand?: string;
};

export async function POST(req: NextRequest) {
  try {
    // API 키가 없으면 빈 추천 반환
    if (!openai) {
      return NextResponse.json({ 
        recommendations: [],
        error: 'OpenAI API key not configured' 
      });
    }

    const { message, availableBeans } = await req.json();

    if (!message || !availableBeans) {
      return NextResponse.json({ error: 'Message and available beans are required' }, { status: 400 });
    }

    // 원두 목록을 문자열로 변환
    const beanList = availableBeans.map((bean: Bean) => {
      const flavorStr = Array.isArray(bean.flavor) ? bean.flavor.join(', ') : bean.flavor;
      return `${bean.name} (${bean.brand || '브랜드 미상'}) - 향미: ${flavorStr}, 배전도: ${bean.roast || '미상'}`;
    }).join('\n');

    const prompt = `
사용자 요청: "${message}"

사용 가능한 원두 목록:
${beanList}

사용자의 요청에 맞는 원두를 최대 3개까지 추천해주세요. 각 추천에 대해 구체적인 이유를 제시해주세요.

응답 형식 (JSON):
{
  "recommendations": [
    {
      "name": "원두명",
      "reason": "추천 이유 (향미, 배전도, 사용자 선호도와의 연관성 등을 포함)"
    }
  ]
}

지침:
1. 사용자의 기분, 선호도, 상황을 고려하여 추천
2. 향미와 배전도 특성을 기반으로 매칭
3. 구체적이고 개인적인 추천 이유 제시
4. 사용 가능한 원두 목록에 있는 것만 추천
5. JSON 형태로만 응답 (추가 설명 없이)
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 전문 바리스타이자 커피 큐레이터입니다. 사용자의 기분과 상황에 맞는 완벽한 원두를 추천하는 전문가입니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    if (!response) {
      return NextResponse.json({ recommendations: [] });
    }

    try {
      const result = JSON.parse(response);
      
      if (!result.recommendations || !Array.isArray(result.recommendations)) {
        return NextResponse.json({ recommendations: [] });
      }

      // 유효한 원두명만 필터링
      const validRecommendations = result.recommendations.filter((rec: any) => {
        return rec.name && rec.reason && 
               availableBeans.some((bean: Bean) => bean.name === rec.name);
      }).slice(0, 3);

      return NextResponse.json({ 
        recommendations: validRecommendations
      });

    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return NextResponse.json({ recommendations: [] });
    }

  } catch (error) {
    console.error('GPT 추천 오류:', error);
    return NextResponse.json({ 
      error: 'GPT 추천 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 