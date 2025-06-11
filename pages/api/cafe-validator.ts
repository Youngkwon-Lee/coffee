import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cafeName, location } = req.body;

    if (!cafeName) {
      return res.status(400).json({ error: '카페명이 필요합니다.' });
    }

    // 명백히 잘못된 카페명 패턴 미리 필터링 (농장명 추가)
    const invalidPatterns = [
      // 원산지 국가명
      /^(PERU|ETHIOPIA|COLOMBIA|KENYA|GUATEMALA|HONDURAS|RWANDA|BURUNDI|COSTA RICA|EL SALVADOR|PANAMA|YEMEN|INDONESIA)(\s|$)/i,
      // 농장명/지역명 패턴
      /^(EL\s+\w+|LA\s+\w+|LAS\s+\w+|LOS\s+\w+|FINCA\s+\w+|HACIENDA\s+\w+)$/i,
      /^(엘\s+\w+|라\s+\w+|로스\s+\w+|핀카\s+\w+)$/i,
      // 특정 유명 농장명들
      /^(EL ROMERILLO|EL PARAISO|EL INJERTO|LA PALMA|LAS FLORES|LA ESPERANZA|LA CRISTALINA)$/i,
      /^(로메리요|파라이소|인헤르토|팔마|플로레스|에스페란사|크리스탈리나)$/i,
      // 가공방식
      /^(Natural|Washed|Honey|Semi-washed|Anaerobic|Carbonic Maceration)(\s|$)/i,
      // 품종명
      /^(Geisha|Bourbon|Typica|Caturra|Pacamara|SL28|SL34)(\s|$)/i,
      // 기타 패턴
      /^\d+$/,  // 숫자만
      /^[A-Z]{1,3}$/,  // 짧은 대문자 (AA, EL 등)
    ];

    const isObviouslyInvalid = invalidPatterns.some(pattern => pattern.test(cafeName));
    
    if (isObviouslyInvalid) {
      let reason = '카페명이 아닌 것으로 판단됨';
      if (/^(EL|LA|LAS|LOS|FINCA|HACIENDA|엘|라|로스|핀카)/i.test(cafeName)) {
        reason = '농장명 또는 지역명으로 판단됨';
      } else if (/^(PERU|ETHIOPIA|COLOMBIA)/i.test(cafeName)) {
        reason = '원산지명으로 판단됨';
      } else if (/^(Natural|Washed|Honey)/i.test(cafeName)) {
        reason = '가공방식으로 판단됨';
      } else if (/^(Geisha|Bourbon|Typica)/i.test(cafeName)) {
        reason = '품종명으로 판단됨';
      }
      
      return res.status(200).json({
        valid: false,
        confidence: 0.95,
        reason,
        cafeName,
        suggestion: '실제 카페명(커피숍 이름)을 입력해주세요',
        webSearchPerformed: false
      });
    }

    // OpenAI + 웹 검색 기반 검증
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const webSearchPrompt = `다음 이름이 실제 존재하는 커피숍(카페)인지 판단해주세요.

카페명: "${cafeName}"
${location ? `위치: ${location}` : ''}

단계별 판단:
1. 이름 패턴 분석:
   - 실제 카페/커피숍 브랜드명 같은가?
   - 농장명(El Romerillo, La Palma 등)이 아닌가?
   - 원산지명(Ethiopia, Peru 등)이 아닌가?
   - 품종명(Geisha, Bourbon 등)이 아닌가?
   - 가공방식(Natural, Washed 등)이 아닌가?

2. 실제 존재 가능성:
   - 일반적인 카페명 패턴인가?
   - 체인점이나 개인 카페로 존재할 수 있는가?
   - 온라인에서 찾을 수 있는 실제 카페인가?

특별 주의사항:
- "엘 로메리요" = 농장명이므로 카페명 아님
- "El Paraiso" = 농장명이므로 카페명 아님  
- "Fritz Coffee Company" = 실제 카페 (예외)

JSON 형태로 응답:
{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "reason": "상세한 판단 근거",
  "category": "cafe|farm|origin|variety|processing|unknown",
  "suggestion": "올바른 분류 제안"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 커피 업계 전문가입니다. 카페명과 농장명, 원산지명을 정확히 구분할 수 있습니다. 실제 카페 존재 여부를 정확히 판단해주세요.'
          },
          {
            role: 'user',
            content: webSearchPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    res.status(200).json({
      valid: result.valid,
      confidence: result.confidence,
      reason: result.reason,
      category: result.category,
      cafeName,
      suggestion: result.suggestion || '',
      webSearchPerformed: true
    });

  } catch (error) {
    console.error('카페 검증 오류:', error);
    res.status(500).json({ 
      error: '카페 검증 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류',
      valid: false,
      confidence: 0,
      webSearchPerformed: false
    });
  }
} 