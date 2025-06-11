import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';

type LearningData = {
  type: 'flavor' | 'bean' | 'cafe';
  original: string; // 원본 텍스트
  mapped: string | string[]; // 매핑된 결과
  confidence: number; // 신뢰도 (0-1)
  userId?: string;
};

export async function POST(req: NextRequest) {
  try {
    console.log('Learning API called');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { type, original, mapped, confidence, userId }: LearningData = body;

    if (!type || !original || !mapped) {
      console.log('Missing fields:', { type, original, mapped });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 매핑된 데이터 검증 - 너무 짧거나 유효하지 않은 데이터 필터링
    let validMapped = mapped;
    if (typeof mapped === 'string') {
      // 너무 짧은 매핑 (2자 이하) 또는 의미없는 패턴 제거
      if (mapped.length <= 2 || 
          mapped.match(/^[A-Z]{1,2}$/) || // 단순 대문자 1-2개
          (mapped.includes('\n') && mapped.split('\n')[0].length <= 3)) { // 줄바꿈 후 첫 줄이 3자 이하
        console.log("Invalid mapping detected, skipping:", mapped);
        return NextResponse.json({ 
          success: false,
          message: 'Invalid mapping data detected and filtered' 
        });
      }
      
      // 여러 줄 중 의미있는 첫 번째 줄만 사용 (원두명/카페명은 보통 한 줄)
      const lines = mapped.split('\n').filter(line => line.trim().length > 3);
      if (lines.length > 1) {
        // 가장 적절한 줄을 선택 (원두명 패턴에 맞는 것)
        const beanPattern = /^[A-Za-z가-힣\s]+[A-Za-z가-힣]$/; // 문자로 시작하고 끝나는 패턴
        const validLine = lines.find(line => beanPattern.test(line.trim()));
        validMapped = validLine ? validLine.trim() : lines[0].trim();
      }
    }

    // 신뢰도가 낮으면 학습하지 않음
    if (confidence < 0.7) {
      console.log('Confidence too low:', confidence);
      return NextResponse.json({ message: 'Confidence too low, not learning' });
    }

    console.log('Starting learning process...');

    // 학습 데이터 저장
    const learningRef = doc(db, 'learning_data', `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    await setDoc(learningRef, {
      type,
      original: original.toLowerCase().trim(),
      mapped: validMapped,
      confidence,
      userId,
      createdAt: new Date().toISOString(),
      learnedCount: 1,
      lastUsed: new Date().toISOString()
    });
    
    console.log('Learning data saved');

    // 전역 매핑 테이블 업데이트
    const mappingRef = doc(db, 'global_mappings', type);
    const mappingDoc = await getDoc(mappingRef);
    
    if (mappingDoc.exists()) {
      console.log('Updating existing mapping');
      const currentData = mappingDoc.data();
      const newMappings = { ...currentData.mappings };
      
      // 기존 매핑이 있으면 카운트 증가, 없으면 새로 추가
      const key = original.toLowerCase().trim();
      if (newMappings[key]) {
        newMappings[key].count += 1;
        newMappings[key].lastUsed = new Date().toISOString();
      } else {
        newMappings[key] = {
          mapped: validMapped,
          confidence,
          count: 1,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        };
      }
      
      await updateDoc(mappingRef, {
        mappings: newMappings,
        lastUpdated: new Date().toISOString()
      });
    } else {
      console.log('Creating new mapping');
      // 첫 번째 매핑인 경우
      await setDoc(mappingRef, {
        mappings: {
          [original.toLowerCase().trim()]: {
            mapped: validMapped,
            confidence,
            count: 1,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    console.log('Learning completed successfully');
    return NextResponse.json({ 
      message: 'Learning data saved successfully',
      learned: true
    });

  } catch (error) {
    console.error('Learning update error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return NextResponse.json({ 
      error: 'Failed to save learning data',
      details: (error as Error).message
    }, { status: 500 });
  }
}

// 학습된 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') as 'flavor' | 'bean' | 'cafe';
    const query = url.searchParams.get('query');

    if (!type || !query) {
      return NextResponse.json({ error: 'Missing type or query' }, { status: 400 });
    }

    const mappingRef = doc(db, 'global_mappings', type);
    const mappingDoc = await getDoc(mappingRef);
    
    if (mappingDoc.exists()) {
      const data = mappingDoc.data();
      const key = query.toLowerCase().trim();
      
      if (data.mappings[key]) {
        const mapping = data.mappings[key];
        return NextResponse.json({
          found: true,
          mapped: mapping.mapped,
          confidence: mapping.confidence,
          count: mapping.count
        });
      }
    }

    return NextResponse.json({ found: false });

  } catch (error) {
    console.error('Learning query error:', error);
    return NextResponse.json({ 
      error: 'Failed to query learning data' 
    }, { status: 500 });
  }
} 