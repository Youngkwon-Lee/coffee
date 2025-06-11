import { NextRequest, NextResponse } from 'next/server';

// OCR은 이제 클라이언트 사이드(Tesseract.js)에서 처리하므로
// 이 API는 더 이상 사용되지 않습니다.
// 호환성을 위해 유지하되, 사용 안 함을 알리는 응답 반환

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'OCR API is deprecated',
      message: 'OCR processing has been moved to client-side using Tesseract.js for better performance'
    },
    { status: 410 } // Gone
  );
}

// GET 메서드는 지원하지 않음
export async function GET() {
  return NextResponse.json(
    { error: 'POST 메서드만 지원됩니다.' },
    { status: 405 }
  );
} 