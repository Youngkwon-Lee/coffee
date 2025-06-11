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
            {/* 사진 기록하기 - 큰 카메라 아이콘 추가 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                router.push("/record/photo");
                setOpen(false);
              }}
              className="flex flex-col items-center bg-gradient-to-r from-coffee-500 to-coffee-600 text-white rounded-2xl shadow-xl px-6 py-4 min-w-[120px] hover:from-coffee-600 hover:to-coffee-700 transition-all duration-200"
            >
              <span className="text-4xl mb-2">📸</span>
              <span className="text-sm font-bold">사진으로 기록</span>
            </motion.button>
            
            {/* 직접 입력하기 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                router.push("/record/manual");
                setOpen(false);
              }}
              className="flex flex-col items-center bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-2xl shadow-xl px-4 py-3 min-w-[100px] hover:from-orange-500 hover:to-red-500 transition-all duration-200"
            >
              <span className="text-2xl mb-1">✍️</span>
              <span className="text-xs font-medium">직접 입력</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 플로팅 메인 버튼 - 카메라 아이콘과 + 아이콘 조합 */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="relative w-16 h-16 rounded-full bg-gradient-to-r from-coffee-500 to-coffee-600 flex items-center justify-center shadow-xl border-4 border-white transition-all duration-200 group hover:from-coffee-600 hover:to-coffee-700"
        aria-label="커피 기록하기"
      >
        <span className="text-white text-2xl font-bold">
          {open ? "×" : "📸"}
        </span>
        
        {/* 호버 툴팁 */}
        {!open && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            커피 기록하기
          </div>
        )}
      </motion.button>
    </div>
  );
} 