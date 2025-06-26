'use client';

import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../src/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useCustomAlert } from '../components/CustomAlert';

export default function ChatBotRecorder() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [recordData, setRecordData] = useState({
    beanName: '',
    brand: '',
    brewMethod: '',
    flavor: [] as string[],
    rating: 0,
    notes: ''
  });

  const brewMethods = ['에스프레소', '드립커피', '프렌치프레스', '콜드브루', '아메리카노', '라떼', '기타'];
  const flavorOptions = ['Floral', 'Fruity', 'Nutty', 'Chocolate', 'Earthy', 'Sweet', 'Bold', 'Clean'];

  const questions = [
    {
      text: "안녕하세요! 어떤 원두로 커피를 마셨나요? ☕",
      type: "text",
      key: "beanName"
    },
    {
      text: "어떤 브랜드인가요? 🏪",
      type: "text", 
      key: "brand"
    },
    {
      text: "어떤 방식으로 추출하셨나요? 🔥",
      type: "select",
      key: "brewMethod",
      options: brewMethods
    },
    {
      text: "어떤 향미를 느끼셨나요? (여러 개 선택 가능) 🌸",
      type: "multiselect",
      key: "flavor",
      options: flavorOptions
    },
    {
      text: "몇 점을 주고 싶으신가요? ⭐",
      type: "rating",
      key: "rating"
    },
    {
      text: "추가로 남기고 싶은 메모가 있나요? 📝",
      type: "textarea",
      key: "notes"
    }
  ];

  const handleAnswer = (value: any) => {
    setRecordData(prev => ({
      ...prev,
      [questions[step].key]: value
    }));
    
    if (step < questions.length - 1) {
      setStep(step + 1);
    }
  };

  const saveRecord = async () => {
    if (!user) {
      showAlert({
        type: 'warning',
        title: '로그인 필요',
        message: '로그인이 필요합니다.'
      });
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "coffee_records"), {
        ...recordData,
        createdAt: new Date().toISOString(),
        userId: user.uid
      });
      
      showAlert({
        type: 'success',
        title: '저장 완료',
        message: '커피 기록이 저장되었습니다! ☕',
        onConfirm: () => router.push('/records')
      });
    } catch (error) {
      console.error("기록 저장 실패:", error);
      showAlert({
        type: 'error',
        title: '저장 실패',
        message: '저장에 실패했습니다. 다시 시도해주세요.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">로그인이 필요해요</h2>
          <p className="text-gray-600 mb-6">커피 기록을 작성하려면 로그인해주세요</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-100 pt-20 pb-8">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* 페이지 타이틀 - 카페 페이지 스타일 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            📚 My Coffee Journey
          </h1>
          <p className="text-gray-600 text-lg">{user?.displayName || '이영권'}님의 커피 기록</p>
        </div>

        <div className="max-w-2xl mx-auto">
        {/* 진행 상황 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">진행 상황</span>
            <span className="text-sm text-gray-600">{step + 1} / {questions.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* 챗봇 UI */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full flex items-center justify-center text-2xl">
              🤖
            </div>
            <div className="flex-1">
              <div className="bg-gray-100 rounded-2xl p-4">
                <p className="text-gray-800">{currentQuestion.text}</p>
              </div>
            </div>
          </div>

          {/* 답변 입력 */}
          <div className="ml-16">
            {currentQuestion.type === "text" && (
              <input
                type="text"
                placeholder="답변을 입력해주세요..."
                className="w-full p-4 border border-gray-200 rounded-2xl focus:border-amber-400 focus:outline-none transition-all duration-300"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleAnswer(e.currentTarget.value.trim());
                    e.currentTarget.value = '';
                  }
                }}
              />
            )}

            {currentQuestion.type === "select" && (
              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className="p-3 border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all duration-300 text-left"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === "multiselect" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options?.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        const currentFlavors = recordData.flavor as string[];
                        const newFlavors = currentFlavors.includes(option)
                          ? currentFlavors.filter(f => f !== option)
                          : [...currentFlavors, option];
                        setRecordData(prev => ({ ...prev, flavor: newFlavors }));
                      }}
                      className={`p-3 border rounded-xl transition-all duration-300 text-left ${
                        (recordData.flavor as string[]).includes(option)
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleAnswer(recordData.flavor)}
                  className="w-full p-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300"
                  disabled={(recordData.flavor as string[]).length === 0}
                >
                  다음으로 ({(recordData.flavor as string[]).length}개 선택됨)
                </button>
              </div>
            )}

            {currentQuestion.type === "rating" && (
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleAnswer(rating)}
                    className="text-4xl hover:scale-110 transition-transform duration-200"
                  >
                    {rating <= recordData.rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === "textarea" && (
              <div className="space-y-4">
                <textarea
                  placeholder="메모를 입력해주세요... (선택사항)"
                  className="w-full p-4 border border-gray-200 rounded-2xl focus:border-amber-400 focus:outline-none transition-all duration-300 h-32 resize-none"
                  onChange={(e) => setRecordData(prev => ({ ...prev, notes: e.target.value }))}
                />
                <button
                  onClick={() => saveRecord()}
                  disabled={isLoading}
                  className="w-full p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : '커피 기록 저장하기 ☕'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 이전 단계 버튼 */}
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="w-full p-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all duration-300"
          >
            이전 질문으로 돌아가기
          </button>
        )}
        </div>
      </div>
      
      <AlertComponent />
    </div>
  );
} 