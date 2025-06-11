import { NextApiRequest, NextApiResponse } from 'next';

interface LearnedData {
  id: string;
  type: 'bean' | 'cafe' | 'flavor' | 'processing';
  original: string;
  mapped: string | string[];
  confidence: number;
  count: number;
  source?: 'pattern' | 'llm' | 'ocr';
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 실제 구현에서는 데이터베이스에서 통계를 조회해야 합니다
    // 여기서는 임시로 localStorage 기반 통계를 반환합니다
    
    const stats = {
      totalLearned: 0,
      byType: {
        bean: { count: 0, avgConfidence: 0, sources: { pattern: 0, llm: 0, ocr: 0 } },
        cafe: { count: 0, avgConfidence: 0, sources: { pattern: 0, llm: 0, ocr: 0 } },
        flavor: { count: 0, avgConfidence: 0, sources: { pattern: 0, llm: 0, ocr: 0 } },
        processing: { count: 0, avgConfidence: 0, sources: { pattern: 0, llm: 0, ocr: 0 } }
      },
      recentActivity: [] as Array<{
        type: string;
        original: string;
        mapped: string;
        confidence: number;
        source: string;
        timestamp: string;
      }>
    };

    res.status(200).json({
      success: true,
      stats,
      message: "학습 데이터 통계 조회 완료"
    });

  } catch (error) {
    console.error('학습 통계 조회 오류:', error);
    res.status(500).json({ 
      error: '학습 통계 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
} 