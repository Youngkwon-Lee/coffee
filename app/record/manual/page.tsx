"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/firebase";
import { collection, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCustomAlert } from "../../components/CustomAlert";

const FLAVOR_CATEGORIES = [
  {
    category: "Fruity",
    options: ["Citrus", "Berry-like", "Winey", "Floral", "Fruity"]
  },
  {
    category: "Nutty & Sweet",
    options: ["Nutty", "Malty", "Candy-like", "Syrup-like", "Chocolate-like", "Vanilla-like", "Caramel"]
  },
  {
    category: "Herby & Spicy",
    options: ["Herby", "Spicy", "Resinous", "Medicinal"]
  },
  {
    category: "Acidity & Sour",
    options: ["Sour", "Acidic", "Tart"]
  },
  {
    category: "Bitter & Others",
    options: ["Bitter", "Mellow", "Sweet", "Earthy", "Smoky", "Astringent"]
  }
];

export default function RecordManualPage() {
  const router = useRouter();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [userId, setUserId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    cafe: "",
    bean: "",
    flavor: [] as string[],
    rating: 0,
    mood: "",
    review: "",
    roasting: "",
    brewMethod: ""
  });

  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  const handleCategoryToggle = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleFlavorClick = (flavor: string) => {
    setForm(prev => ({
      ...prev,
      flavor: prev.flavor.includes(flavor)
        ? prev.flavor.filter(f => f !== flavor)
        : [...prev.flavor, flavor]
    }));
  };

  const handleSave = async () => {
    if (!userId) {
      showAlert({
        type: 'warning',
        title: '로그인 필요',
        message: '커피 기록을 저장하려면 로그인이 필요합니다.'
      });
      return;
    }

    if (!form.cafe || !form.bean) {
      showAlert({
        type: 'warning',
        title: '필수 정보 누락',
        message: '카페명과 원두명은 필수 입력 항목입니다.'
      });
      return;
    }

    try {
      await addDoc(collection(db, `users/${userId}/coffee_records`), {
        ...form,
        createdAt: new Date(),
        type: 'manual'
      });

      showAlert({
        type: 'success',
        title: '저장 완료',
        message: '커피 기록이 성공적으로 저장되었습니다!',
        onConfirm: () => router.push('/')
      });
    } catch (error) {
      console.error("저장 오류:", error);
      showAlert({
        type: 'error',
        title: '저장 실패',
        message: '커피 기록 저장 중 오류가 발생했습니다.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-coffee-dark p-4">
      <div className="max-w-md mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => router.back()}
            className="text-coffee-light opacity-70 hover:opacity-100"
          >
            ✕
          </button>
          <h1 className="text-lg font-semibold text-coffee-light">새 커피 기록</h1>
          <div className="w-6"></div>
        </div>

        {/* 메인 폼 */}
        <div className="space-y-6">
          {/* 카페/장소 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              카페/장소 *
            </label>
            <input
              type="text"
              value={form.cafe}
              onChange={(e) => setForm(prev => ({ ...prev, cafe: e.target.value }))}
              placeholder="예: 블루보틀"
              className="w-full bg-coffee-medium border border-coffee-gold border-opacity-20 rounded-lg px-4 py-3 text-coffee-light placeholder-coffee-light placeholder-opacity-50 focus:outline-none focus:border-coffee-gold"
            />
          </div>

          {/* 원두명 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              원두명 *
            </label>
            <input
              type="text"
              value={form.bean}
              onChange={(e) => setForm(prev => ({ ...prev, bean: e.target.value }))}
              placeholder="예: 에티오피아 예가체프"
              className="w-full bg-coffee-medium border border-coffee-gold border-opacity-20 rounded-lg px-4 py-3 text-coffee-light placeholder-coffee-light placeholder-opacity-50 focus:outline-none focus:border-coffee-gold"
            />
          </div>

          {/* 플레이버 선택 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              플레이버 선택
            </label>
            <div className="space-y-2">
              {FLAVOR_CATEGORIES.map((category) => (
                <div key={category.category} className="border border-coffee-gold border-opacity-20 rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleCategoryToggle(category.category)}
                    className="w-full bg-coffee-medium px-4 py-3 text-left text-coffee-light font-medium flex items-center justify-between hover:bg-opacity-80"
                  >
                    <span>{category.category}</span>
                    <span className={`transform transition-transform ${openCategories.includes(category.category) ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {openCategories.includes(category.category) && (
                    <div className="p-3 bg-coffee-dark bg-opacity-30">
                      <div className="flex flex-wrap gap-2">
                        {category.options.map((flavor) => (
                          <button
                            key={flavor}
                            onClick={() => handleFlavorClick(flavor)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              form.flavor.includes(flavor)
                                ? 'bg-coffee-gold text-coffee-dark'
                                : 'bg-coffee-medium text-coffee-light hover:bg-coffee-gold hover:text-coffee-dark'
                            }`}
                          >
                            {flavor}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* 선택된 플레이버 표시 */}
            {form.flavor.length > 0 && (
              <div className="mt-3 p-3 bg-coffee-medium rounded-lg">
                <div className="text-sm text-coffee-light opacity-70 mb-2">선택된 플레이버:</div>
                <div className="flex flex-wrap gap-2">
                  {form.flavor.map((flavor) => (
                    <span
                      key={flavor}
                      className="px-2 py-1 bg-coffee-gold text-coffee-dark text-sm rounded-full"
                    >
                      {flavor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 로스팅 단계 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              로스팅 단계
            </label>
            <select
              value={form.roasting}
              onChange={(e) => setForm(prev => ({ ...prev, roasting: e.target.value }))}
              className="w-full bg-coffee-medium border border-coffee-gold border-opacity-20 rounded-lg px-4 py-3 text-coffee-light focus:outline-none focus:border-coffee-gold"
            >
              <option value="">선택하세요</option>
              <option value="Light">Light (라이트)</option>
              <option value="Medium-Light">Medium-Light (미디엄 라이트)</option>
              <option value="Medium">Medium (미디엄)</option>
              <option value="Medium-Dark">Medium-Dark (미디엄 다크)</option>
              <option value="Dark">Dark (다크)</option>
              <option value="French">French (프렌치)</option>
            </select>
          </div>

          {/* 추출 방식 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              추출 방식
            </label>
            <select
              value={form.brewMethod}
              onChange={(e) => setForm(prev => ({ ...prev, brewMethod: e.target.value }))}
              className="w-full bg-coffee-medium border border-coffee-gold border-opacity-20 rounded-lg px-4 py-3 text-coffee-light focus:outline-none focus:border-coffee-gold"
            >
              <option value="">선택하세요</option>
              <option value="Espresso">에스프레소</option>
              <option value="Americano">아메리카노</option>
              <option value="Drip">드립커피</option>
              <option value="French Press">프렌치 프레스</option>
              <option value="V60">V60</option>
              <option value="Chemex">케멕스</option>
              <option value="Aeropress">에어로프레스</option>
              <option value="Cold Brew">콜드브루</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 별점 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              별점
            </label>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setForm(prev => ({ ...prev, rating: star }))}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="text-2xl transition-colors"
                >
                  <span className={
                    star <= (hoveredRating || form.rating)
                      ? 'text-coffee-gold'
                      : 'text-coffee-light opacity-30'
                  }>
                    ★
                  </span>
                </button>
              ))}
              <span className="ml-3 text-coffee-light opacity-70">
                {form.rating > 0 ? `${form.rating}/5` : '별점을 선택하세요'}
              </span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-coffee-light font-medium mb-2">
              메모
            </label>
            <textarea
              value={form.review}
              onChange={(e) => setForm(prev => ({ ...prev, review: e.target.value }))}
              placeholder="커피에 대한 느낌이나 기억하고 싶은 점을 적어보세요..."
              rows={4}
              className="w-full bg-coffee-medium border border-coffee-gold border-opacity-20 rounded-lg px-4 py-3 text-coffee-light placeholder-coffee-light placeholder-opacity-50 focus:outline-none focus:border-coffee-gold resize-none"
            />
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="mt-8 pb-8">
          <button
            onClick={handleSave}
            className="w-full bg-coffee-gold text-coffee-dark py-4 rounded-lg font-semibold text-lg hover:bg-opacity-90 transition-colors"
          >
            기록 저장
          </button>
        </div>
      </div>

      <AlertComponent />
    </div>
  );
} 