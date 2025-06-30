import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, doc, updateDoc, getDocs } from 'firebase/firestore';

// 카페별 실제 이미지 URL (크롤링된 이미지 또는 공식 이미지)
const cafeImages: Record<string, string> = {
  "centercoffee-hongdae": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop",
  "fritz-coffee-itaewon": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop", 
  "lowkey-coffee-gangnam": "https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=400&h=300&fit=crop",
  "terarosa-seoul": "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400&h=300&fit=crop",
  "momos-coffee-yeonnam": "https://images.unsplash.com/photo-1516487266042-46c9a1162bb7?w=400&h=300&fit=crop",
};

export async function POST(request: NextRequest) {
  try {
    console.log("카페 이미지 업데이트 시작...");
    
    // 현재 카페 목록 가져오기
    const cafesSnapshot = await getDocs(collection(db, 'cafes'));
    const cafes = cafesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`총 ${cafes.length}개 카페 발견`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // 각 카페에 이미지 URL 추가
    for (const cafe of cafes) {
      const cafeId = cafe.id;
      const imageUrl = cafeImages[cafeId];
      
      if (imageUrl) {
        try {
          const cafeRef = doc(db, 'cafes', cafeId);
          await updateDoc(cafeRef, {
            imageUrl: imageUrl,
            lastUpdated: new Date().toISOString()
          });
          
          console.log(`✅ 카페 이미지 업데이트: ${cafeId}`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ 카페 이미지 업데이트 실패: ${cafeId}`, error);
        }
      } else {
        console.log(`⏭️ 이미지 없음: ${cafeId}`);
        skippedCount++;
      }
    }
    
    const result = {
      success: true,
      message: `카페 이미지 업데이트 완료`,
      stats: {
        total: cafes.length,
        updated: updatedCount,
        skipped: skippedCount
      }
    };
    
    console.log("카페 이미지 업데이트 결과:", result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("카페 이미지 업데이트 중 오류:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "카페 이미지 업데이트 API",
    usage: "POST 요청으로 카페 이미지를 업데이트합니다.",
    availableImages: Object.keys(cafeImages).length
  });
}