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
              className="flex flex-col items-center bg-white rounded-xl shadow-lg px-4 py-2 min-w-[90px]"
            >
              <span className="text-2xl">📷</span>
              <span className="text-xs mt-1">사진 기록하기</span>
            </button>
            {/* 직접 입력하기 */}
            <button
              onClick={() => {
                router.push("/record/manual");
                setOpen(false);
              }}
              className="flex flex-col items-center bg-white rounded-xl shadow-lg px-4 py-2 min-w-[90px]"
            >
              <span className="text-2xl">✍️</span>
              <span className="text-xs mt-1">직접 입력하기</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 플로팅 + 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center shadow-xl text-3xl border-4 border-white"
        aria-label="기록 추가"
      >
        {open ? "✕" : "+"}
      </button>
    </div>
  );
} 