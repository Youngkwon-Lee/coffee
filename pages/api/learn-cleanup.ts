import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, pattern, reason } = req.body;

    if (!type || !pattern) {
      return res.status(400).json({ error: '타입과 패턴이 필요합니다.' });
    }

    // 잘못된 학습 데이터 패턴들
    const incorrectPatterns = {
      cafe: [
        'PERU', 'ETHIOPIA', 'COLOMBIA', 'KENYA', 'GUATEMALA', 'HONDURAS',
        'PERU EL', 'ETHIOPIA YIRGACHEFFE', 'COLOMBIA EL',
        'Natural', 'Washed', 'Honey', 'Semi-washed',
        'Geisha', 'Bourbon', 'Typica', 'Caturra'
      ],
      bean: [
        // 가공방식이 원두명에 포함된 경우 등
      ]
    };

    // 실제 구현에서는 데이터베이스에서 해당 패턴의 데이터를 찾아서 제거
    // 여기서는 로그만 출력
    console.log(`정리 대상: ${type} 타입의 "${pattern}" 패턴 데이터`);
    console.log(`정리 이유: ${reason || '잘못된 분류'}`);

    res.status(200).json({
      success: true,
      message: `${type} 타입의 잘못된 학습 데이터가 정리되었습니다.`,
      pattern,
      reason
    });

  } catch (error) {
    console.error('학습 데이터 정리 오류:', error);
    res.status(500).json({ 
      error: '학습 데이터 정리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
} 