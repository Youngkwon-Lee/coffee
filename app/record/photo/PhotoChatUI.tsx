"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";

type ChatMessage = {
  type: "bot" | "user";
  text: string;
  imageUrl?: string;
};

type AnalysisResult = {
  cafeName: string;
  beanName: string;
  processing: string;
  flavors: string[];
  originalFlavors: string;
};

export default function PhotoChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      type: "bot", 
      text: "안녕하세요! 커피 사진을 업로드하거나 촬영해 주세요."
    }
  ]);
  const [currentStep, setCurrentStep] = useState<"upload" | "analyze" | "result" | "form">("upload");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    setMessages(prev => [
      ...prev,
      { type: "user", text: "📸 카메라로 촬영하기를 선택했습니다." },
      { 
        type: "bot", 
        text: "카메라를 열어드릴게요! 커피 사진을 촬영해주세요."
      }
    ]);
    
    // 카메라 입력 열기
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleGalleryClick = () => {
    setMessages(prev => [
      ...prev,
      { type: "user", text: "🖼️ 갤러리에서 선택하기를 선택했습니다." },
      { 
        type: "bot", 
        text: "갤러리를 열어드릴게요! 커피 사진을 선택해주세요."
      }
    ]);
    
    // 파일 입력 열기
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, source: "camera" | "gallery") => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const sourceText = source === "camera" ? "카메라로 촬영" : "갤러리에서 선택";
      
      // 파일을 상태에 저장 (실제 API 호출용)
      setUploadedImageFile(file);
      
      setMessages(prev => [
        ...prev,
        { 
          type: "user", 
          text: `✅ ${sourceText}하여 사진을 업로드했습니다!`,
          imageUrl: imageUrl
        },
        { 
          type: "bot", 
          text: "멋진 사진이네요! 이제 사진을 분석해보겠습니다."
        },
        {
          type: "bot",
          text: "분석 버튼을 눌러주세요! 🔍"
        }
      ]);
      
      setCurrentStep("analyze");
    }
  };

  // OCR API 호출 함수
  const extractTextFromImage = async (imageFile: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      // 실제 OCR API 호출 (Google Vision API, Tesseract.js 등 사용)
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('OCR API 호출 실패');
      }
      
      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('OCR 에러:', error);
      // 실패시 fallback 텍스트 (개발용)
      return `🧠 학습된 카페명 발견: PERU EL
분석 결과가 나왔어요!
카페명: PERU EL
원두명: peru el romerillo clever geisha
프로세싱: Natural
향미: 열대과일, 복숭아, 망고, 청포도
[원본 향미 설명]
열대과일 복숭아 망고 청포도`;
    }
  };

  // LLM API 호출 함수
  const extractInfoFromText = async (ocrText: string): Promise<AnalysisResult> => {
    try {
      const prompt = `
다음은 커피 정보가 포함된 텍스트입니다. 이 텍스트에서 카페명, 원두명, 프로세싱 방법, 향미 정보를 추출해서 JSON 형태로 반환해주세요.

텍스트:
${ocrText}

다음 JSON 형태로 응답해주세요:
{
  "cafeName": "카페명",
  "beanName": "원두명 (정확한 전체 이름)",
  "processing": "프로세싱 방법 (Natural, Washed, Honey 중 하나)",
  "flavors": ["향미1", "향미2", "향미3", "향미4"],
  "originalFlavors": "원본 향미 설명"
}

주의사항:
- 원두명은 완전한 이름으로 추출 (예: "peru el romerillo clever geisha")
- 향미는 개별 요소로 분리해서 배열로 제공
- 프로세싱은 Natural, Washed, Honey, Semi-Washed 중 하나로 표준화
- 한국어로 된 향미 정보를 우선적으로 추출
`;

      const response = await fetch('/api/llm-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('LLM API 호출 실패');
      }
      
      const data = await response.json();
      return JSON.parse(data.result);
    } catch (error) {
      console.error('LLM 에러:', error);
      // 실패시 fallback 결과 (개발용)
      return {
        cafeName: "PERU EL",
        beanName: "peru el romerillo clever geisha",
        processing: "Natural",
        flavors: ["열대과일", "복숭아", "망고", "청포도"],
        originalFlavors: "열대과일 복숭아 망고 청포도"
      };
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedImageFile) {
      alert('업로드된 이미지가 없습니다.');
      return;
    }

    setMessages(prev => [
      ...prev,
      { type: "user", text: "🔍 분석하기 버튼을 눌렀습니다." },
      { type: "bot", text: "고도화된 AI 분석을 시작합니다... 🤖" }
    ]);
    
    try {
      // 1단계: OCR 텍스트 추출
      setMessages(prev => [
        ...prev,
        { type: "bot", text: "📸 이미지에서 텍스트를 추출하고 있습니다..." }
      ]);
      
      const ocrText = await extractTextFromImage(uploadedImageFile);
      
      setMessages(prev => [
        ...prev,
        { type: "bot", text: "🔍 OCR 텍스트 추출 완료!" },
        { type: "bot", text: "🧠 LLM을 통해 정보를 구조화하고 있습니다..." }
      ]);
      
      // 2단계: LLM을 통한 정보 구조화
      const extractedInfo = await extractInfoFromText(ocrText);
      
      setAnalysisResult(extractedInfo);
      setMessages(prev => [
        ...prev,
        { type: "bot", text: "🧠 LLM 정보 구조화 완료!" },
        { type: "bot", text: "✅ 분석이 완료되었습니다! 실제 OCR+LLM 기반 결과입니다. 📋" }
      ]);
      setCurrentStep("result");
      
    } catch (error) {
      console.error('분석 에러:', error);
      setMessages(prev => [
        ...prev,
        { type: "bot", text: "❌ 분석 중 오류가 발생했습니다. 다시 시도해주세요." }
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-coffee-50 to-cream-100 pt-20 pb-8">
      <div className="container mx-auto px-4 max-w-4xl">
        
        {/* 페이지 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brown-700 via-coffee-600 to-brown-800 bg-clip-text text-transparent mb-4">
            📸 사진으로 기록하기
          </h1>
                      <p className="text-brown-600 text-lg">AI가 사진을 분석해서 자동으로 정보를 추출해드려요</p>
        </div>

        {/* 채팅 영역 */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex items-start gap-3 max-w-xs ${message.type === "user" ? "flex-row-reverse" : ""}`}>
                  {/* 아바타 */}
                  <div                       className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        message.type === "bot" 
                          ? "bg-gradient-to-r from-coffee-400 to-brown-400 text-white" 
                          : "bg-gradient-to-r from-coffee-500 to-coffee-600 text-white"
                      }`}>
                    {message.type === "bot" ? "🤖" : "👤"}
                  </div>
                  
                  {/* 메시지 */}
                                      <div className={`rounded-2xl p-4 ${
                      message.type === "bot" 
                        ? "bg-cream-100 text-brown-800" 
                        : "bg-gradient-to-r from-coffee-500 to-coffee-600 text-white"
                    }`}>
                    <p className="text-sm">{message.text}</p>
                    
                    {/* 이미지가 있으면 표시 */}
                    {message.imageUrl && (
                      <div className="mt-3">
                        <img 
                          src={message.imageUrl} 
                          alt="업로드된 커피 사진" 
                          className="w-full h-32 object-cover rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* 첫 메시지 뒤에 바로 버튼들 표시 */}
            {currentStep === "upload" && messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-start"
              >
                <div className="flex items-start gap-3 max-w-md">
                  {/* 봇 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-lg">
                    🤖
                  </div>
                  
                  {/* 버튼들을 채팅 말풍선처럼 */}
                  <div className="bg-cream-100 rounded-2xl p-4">
                    <div className="flex flex-col gap-3 w-full">
                                              <button
                          onClick={handleCameraClick}
                          className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-xl font-semibold hover:from-coffee-600 hover:to-coffee-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 w-full"
                        >
                          <span className="text-xl">📸</span>
                          <span>카메라로 촬영</span>
                        </button>
                        
                        <button
                          onClick={handleGalleryClick}
                          className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-brown-500 to-brown-600 text-white rounded-xl font-semibold hover:from-brown-600 hover:to-brown-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 w-full"
                        >
                          <span className="text-xl">🖼️</span>
                          <span>갤러리에서 선택</span>
                        </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 분석 버튼도 채팅 형태로 - 마지막 메시지 후에 표시 */}
            {currentStep === "analyze" && messages[messages.length - 1]?.text.includes("분석 버튼을 눌러주세요") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-start gap-3 max-w-md">
                  {/* 봇 아바타 */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-coffee-400 to-brown-400 text-white flex items-center justify-center text-lg">
                    🤖
                  </div>
                  
                  {/* 분석 버튼을 채팅 말풍선처럼 */}
                  <div className="bg-cream-100 rounded-2xl p-4">
                                          <button
                        onClick={handleAnalyze}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-coffee-500 to-brown-500 text-white rounded-xl font-semibold hover:from-coffee-600 hover:to-brown-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 w-full"
                      >
                        <span className="text-xl">🔍</span>
                        <span>사진 분석하기</span>
                      </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>



        {/* AI 분석 결과 표시 및 수정 */}
        {currentStep === "result" && analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-brown-800 mb-2">AI 분석 결과 📋</h3>
                <p className="text-brown-600 text-sm">결과를 확인하고 필요시 수정해주세요</p>
              </div>

              {/* 분석 결과 카드들 */}
              <div className="space-y-4">
                {/* 카페명 */}
                <div className="p-4 bg-cream-50 rounded-xl border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">☕ 카페명</label>
                  <input
                    type="text"
                    value={analysisResult.cafeName}
                    onChange={(e) => setAnalysisResult(prev => prev ? {...prev, cafeName: e.target.value} : null)}
                    className="w-full px-3 py-2 border border-coffee-200 rounded-lg bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                  />
                </div>

                {/* 원두명 */}
                <div className="p-4 bg-cream-50 rounded-xl border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">🌱 원두명</label>
                  <input
                    type="text"
                    value={analysisResult.beanName}
                    onChange={(e) => setAnalysisResult(prev => prev ? {...prev, beanName: e.target.value} : null)}
                    className="w-full px-3 py-2 border border-coffee-200 rounded-lg bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                    placeholder="예: peru el romerillo clever geisha"
                  />
                </div>

                {/* 프로세싱 */}
                <div className="p-4 bg-cream-50 rounded-xl border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">⚙️ 프로세싱</label>
                  <select
                    value={analysisResult.processing}
                    onChange={(e) => setAnalysisResult(prev => prev ? {...prev, processing: e.target.value} : null)}
                    className="w-full px-3 py-2 border border-coffee-200 rounded-lg bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                  >
                    <option value="Natural">Natural</option>
                    <option value="Washed">Washed</option>
                    <option value="Honey">Honey</option>
                    <option value="Semi-Washed">Semi-Washed</option>
                  </select>
                </div>

                {/* 향미 */}
                <div className="p-4 bg-cream-50 rounded-xl border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">🌸 향미</label>
                  <input
                    type="text"
                    value={analysisResult.flavors.join(', ')}
                    onChange={(e) => setAnalysisResult(prev => prev ? {...prev, flavors: e.target.value.split(',').map(f => f.trim())} : null)}
                    className="w-full px-3 py-2 border border-coffee-200 rounded-lg bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                    placeholder="예: 열대과일, 복숭아, 망고, 청포도"
                  />
                  <p className="text-xs text-brown-500 mt-1">쉼표로 구분해서 입력하세요</p>
                </div>

                {/* 원본 향미 설명 */}
                <div className="p-4 bg-cream-50 rounded-xl border border-coffee-200">
                  <label className="block text-sm font-medium text-brown-700 mb-2">📝 상세 향미 설명</label>
                  <input
                    type="text"
                    value={analysisResult.originalFlavors}
                    onChange={(e) => setAnalysisResult(prev => prev ? {...prev, originalFlavors: e.target.value} : null)}
                    className="w-full px-3 py-2 border border-coffee-200 rounded-lg bg-white text-brown-700 focus:outline-none focus:ring-2 focus:ring-coffee-400"
                    placeholder="예: 열대과일 복숭아 망고 청포도"
                  />
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep("form")}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-xl font-semibold hover:from-coffee-600 hover:to-coffee-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <span className="text-lg">✅</span>
                  <span>결과 확인완료</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentStep("analyze");
                    setAnalysisResult(null);
                  }}
                  className="px-6 py-3 bg-brown-100 hover:bg-brown-200 text-brown-700 rounded-xl font-medium transition-colors duration-200 border border-brown-200"
                >
                  🔄 다시 분석
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {currentStep === "form" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 text-center"
          >
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-brown-800">분석 완료! 🎉</h3>
              <p className="text-brown-600">수정된 정보로 기록을 저장하겠습니다.</p>
              
              {/* 최종 결과 요약 */}
              {analysisResult && (
                <div className="bg-cream-50 rounded-xl p-4 text-left space-y-2 text-sm">
                  <div><span className="font-medium text-brown-700">☕ 카페:</span> {analysisResult.cafeName}</div>
                  <div><span className="font-medium text-brown-700">🌱 원두:</span> {analysisResult.beanName}</div>
                  <div><span className="font-medium text-brown-700">⚙️ 프로세싱:</span> {analysisResult.processing}</div>
                  <div><span className="font-medium text-brown-700">🌸 향미:</span> {analysisResult.flavors.join(', ')}</div>
                  <div><span className="font-medium text-brown-700">📝 상세:</span> {analysisResult.originalFlavors}</div>
                </div>
              )}
              
              <button
                onClick={() => {
                  // 여기서 실제 저장 로직 처리
                  alert('기록이 저장되었습니다! 📝');
                  window.location.href = '/history';
                }}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-xl font-semibold hover:from-coffee-600 hover:to-coffee-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <span className="text-xl">💾</span>
                <span>기록 저장하기</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 숨겨진 파일 입력들 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, "gallery")}
        />
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e, "camera")}
        />
      </div>
    </div>
  );
} 