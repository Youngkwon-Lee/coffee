"use client";

import { useRef, useState } from "react";

type ChatMessage = {
  type: "bot" | "user";
  text: string;
  imageUrl?: string;
};

// OCR 결과를 보기 좋게 가공하는 함수
function formatOcrResult(data: any) {
  if (!data) return "분석 결과가 없습니다.";
  if (data.beanName) return `☕️ 추출된 텍스트\n${data.beanName}`;
  return "분석 결과가 없습니다.";
}

export default function RecordPhotoPage() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    { type: "bot", text: "안녕하세요! 커피 사진을 업로드하거나 촬영해 주세요." }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택/촬영 시 미리보기
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, method: "촬영" | "업로드") => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setOcrResult(null);
      setChat(prev => [
        ...prev,
        { type: "user", text: method === "촬영" ? "촬영하기로 사진을 보냈어요!" : "사진을 업로드했어요!" },
        { type: "bot", text: "사진이 업로드되었습니다. OCR 분석을 시작해볼까요?", imageUrl: URL.createObjectURL(file) }
      ]);
    }
  };

  // OCR 분석 요청
  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setChat(prev => [...prev, { type: "user", text: "OCR 분석하기 눌렀어요!" }]);
    const formData = new FormData();
    formData.append("image", image); // bean-analyze API는 'image' 필드 사용

    const res = await fetch("/api/bean-analyze", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setOcrResult(data);
    setLoading(false);
    setChat(prev => [
      ...prev,
      { type: "bot", text: `분석 결과가 나왔어요!\n${formatOcrResult(data)}` }
    ]);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">☕️ 커피 사진 기록 챗봇</h1>
      <div className="flex flex-col gap-2 mb-4">
        {chat.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-line
              ${msg.type === "bot" ? "bg-gray-100 self-start" : "bg-yellow-200 self-end"}
            `}
          >
            {msg.text}
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="업로드 미리보기" className="mt-2 w-40 rounded-lg shadow" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {/* 촬영하기 */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={e => handleFileChange(e, "촬영")}
          className="hidden"
        />
        <button
          className="px-3 py-2 bg-yellow-400 rounded-lg font-bold"
          onClick={() => {
            setChat(prev => [
              ...prev,
              { type: "bot", text: "촬영을 위해 카메라 권한이 필요할 수 있습니다. 허용을 눌러주세요!" }
            ]);
            cameraInputRef.current?.click();
          }}
        >
          📷 촬영하기
        </button>
        {/* 사진 업로드 */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={e => handleFileChange(e, "업로드")}
          className="hidden"
        />
        <button
          className="px-3 py-2 bg-rose-300 rounded-lg font-bold"
          onClick={() => fileInputRef.current?.click()}
        >
          🖼️ 사진 업로드
        </button>
      </div>
      {preview && !ocrResult && (
        <button
          className="px-4 py-2 bg-rose-400 text-white rounded-lg font-bold mb-4 w-full"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? "분석 중..." : "OCR 분석하기"}
        </button>
      )}
    </div>
  );
} 