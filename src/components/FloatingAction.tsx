"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function FloatingAction() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="flex gap-4 mb-4"
          >
            {/* 사진 기록하기 */}
            <button
              onClick={() => {
                // 갤러리/카메라 열기 → OCR → 자동 작성 페이지 이동
                router.push("/record/photo");
                setOpen(false);
              }}
              className="flex flex-col items-center bg-white/90 backdrop-blur-sm rounded-card shadow-card px-4 py-3 min-w-[90px] border border-coffee-200 hover:scale-105 hover:shadow-hover transition-all duration-200"
            >
              <span className="text-2xl">📷</span>
              <span className="text-xs mt-1 text-brown-700 font-medium">사진 기록하기</span>
            </button>
            {/* 직접 입력하기 */}
            <button
              onClick={() => {
                router.push("/record/manual");
                setOpen(false);
              }}
              className="flex flex-col items-center bg-white/90 backdrop-blur-sm rounded-card shadow-card px-4 py-3 min-w-[90px] border border-coffee-200 hover:scale-105 hover:shadow-hover transition-all duration-200"
            >
              <span className="text-2xl">✍️</span>
              <span className="text-xs mt-1 text-brown-700 font-medium">직접 입력하기</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 플로팅 + 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-16 h-16 rounded-full bg-gradient-to-r from-coffee-500 to-coffee-600 flex items-center justify-center shadow-hover text-3xl border-4 border-white hover:scale-110 transition-all duration-200"
        aria-label="기록 추가"
      >
        <span className="text-white font-bold">
        {open ? "✕" : "+"}
        </span>
      </button>
    </div>
  );
} 