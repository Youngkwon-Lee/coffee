"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CoffeeRecord {
  id: string;
  beanName: string;
  flavor: string;
  rating: number;
  brewMethod: string;
  createdAt: string;
  notes?: string;
  price?: string;
  origin?: string;
}

export default function EmailReportModal({ isOpen, onClose }: EmailReportModalProps) {
  const [user] = useAuthState(auth);
  const [email, setEmail] = useState("");
  const [reportType, setReportType] = useState<"weekly" | "monthly" | "all">("weekly");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [records, setRecords] = useState<CoffeeRecord[]>([]);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadRecords();
    }
  }, [isOpen, user, reportType]);

  async function loadRecords() {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const now = new Date();
      let startDate = new Date();
      
      switch (reportType) {
        case "weekly":
          startDate.setDate(now.getDate() - 7);
          break;
        case "monthly":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "all":
          startDate = new Date(2020, 0, 1); // 충분히 오래된 날짜
          break;
      }

      const recordsQuery = query(
        collection(db, "users", user.uid, "coffee_records"),
        where("createdAt", ">=", startDate.toISOString()),
        orderBy("createdAt", "desc")
      );
      
      const recordsSnapshot = await getDocs(recordsQuery);
      const fetchedRecords = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoffeeRecord[];
      
      setRecords(fetchedRecords);
    } catch (error) {
      console.error("기록 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendEmail() {
    if (!email || !user) return;

    try {
      setIsLoading(true);

      // 통계 계산
      const totalCups = records.length;
      const avgRating = records.length > 0 
        ? records.reduce((sum, r) => sum + r.rating, 0) / records.length 
        : 0;
      const favoriteMethod = records.length > 0
        ? records.reduce((acc, record) => {
            acc[record.brewMethod] = (acc[record.brewMethod] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        : {};
      const topMethod = Object.keys(favoriteMethod).reduce((a, b) => 
        favoriteMethod[a] > favoriteMethod[b] ? a : b, "없음"
      );

      const reportData = {
        email,
        reportType,
        user: {
          name: user.displayName,
          email: user.email
        },
        period: {
          start: reportType === "weekly" ? "7일 전" : 
                 reportType === "monthly" ? "30일 전" : "전체 기간",
          end: "현재"
        },
        statistics: {
          totalCups,
          avgRating: avgRating.toFixed(1),
          topMethod,
          totalDays: Math.ceil((new Date().getTime() - new Date(records[records.length - 1]?.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24))
        },
        records: records.slice(0, 50) // 최대 50개
      };

      const response = await fetch('/api/send-coffee-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });

      if (response.ok) {
        setIsSent(true);
        setTimeout(() => {
          setIsSent(false);
          onClose();
        }, 2000);
      } else {
        throw new Error('이메일 전송 실패');
      }

    } catch (error) {
      console.error("이메일 전송 실패:", error);
      alert("이메일 전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  const getReportTitle = () => {
    switch (reportType) {
      case "weekly": return "지난 7일 커피 리포트";
      case "monthly": return "지난 30일 커피 리포트";
      case "all": return "전체 커피 여정 리포트";
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {isSent ? (
            <div className="text-center py-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-6xl mb-4"
              >
                ✅
              </motion.div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                이메일이 전송되었습니다!
              </h2>
              <p className="text-gray-600">
                {email}로 커피 리포트를 보내드렸어요.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                  📧 커피 리포트 이메일 전송
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* 리포트 타입 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    리포트 기간
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "weekly", label: "지난 7일", emoji: "📅" },
                      { value: "monthly", label: "지난 30일", emoji: "🗓️" },
                      { value: "all", label: "전체 기간", emoji: "📊" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setReportType(option.value as any)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          reportType === option.value
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="text-2xl mb-1">{option.emoji}</div>
                        <div className="text-sm font-medium">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 이메일 주소 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    받을 이메일 주소
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                </div>

                {/* 미리보기 */}
                {records.length > 0 && (
                  <div className="bg-amber-50 rounded-xl p-6">
                    <h3 className="font-bold text-amber-800 mb-4 flex items-center">
                      📋 {getReportTitle()} 미리보기
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{records.length}</div>
                        <div className="text-xs text-gray-600">총 커피 잔</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {(records.reduce((sum, r) => sum + r.rating, 0) / records.length).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600">평균 평점</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-lg font-bold text-red-600">
                          드립
                        </div>
                        <div className="text-xs text-gray-600">선호 추출법</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {new Set(records.map(r => r.beanName)).size}
                        </div>
                        <div className="text-xs text-gray-600">다른 원두</div>
                      </div>
                    </div>

                    <div className="text-sm text-amber-700">
                      💡 상세한 리포트와 차트가 이메일로 전송됩니다.
                    </div>
                  </div>
                )}

                {/* 전송 버튼 */}
                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={!email || isLoading}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        전송 중...
                      </div>
                    ) : (
                      "이메일 전송하기 📧"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 