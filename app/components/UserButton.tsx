"use client";

import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCustomAlert } from "./CustomAlert";

function useFirebaseAuth() {
  // auth가 null이면(환경변수 미설정) 빈 상태 반환
  if (!auth) return [null, false, undefined] as const;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuthState(auth);
}

export default function UserButton() {
  const [user, loading] = useFirebaseAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showAlert({
        type: 'success',
        title: '로그아웃 완료',
        message: '성공적으로 로그아웃되었습니다.',
        confirmText: '확인'
      });
      setShowDropdown(false);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      showAlert({
        type: 'error',
        title: '로그아웃 실패',
        message: '로그아웃 중 오류가 발생했습니다.',
        confirmText: '확인'
      });
    }
  };

  const handleLogin = () => {
    router.push('/login');
    setShowDropdown(false);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-button-container')) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-coffee-medium animate-pulse"></div>
    );
  }

  return (
    <>
      <div className="relative user-button-container">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 text-coffee-light hover:text-coffee-gold transition-colors"
        >
          {user ? (
            <>
              {/* 사용자 아바타 */}
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || '사용자'}
                  className="w-8 h-8 rounded-full border-2 border-coffee-gold"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-coffee-gold flex items-center justify-center">
                  <span className="text-coffee-dark text-sm font-bold">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {/* 드롭다운 아이콘 */}
              <svg 
                className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </>
          ) : (
            <>
              {/* 로그인 아이콘 */}
              <div className="w-8 h-8 rounded-full bg-coffee-medium flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </>
          )}
        </button>

        {/* 드롭다운 메뉴 */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-coffee-medium rounded-xl shadow-2xl border border-coffee-gold/20 py-2 z-50">
            {user ? (
              <>
                {/* 사용자 정보 */}
                <div className="px-4 py-3 border-b border-coffee-gold/20">
                  <p className="text-coffee-light font-medium truncate">
                    {user.displayName || '사용자'}
                  </p>
                  <p className="text-coffee-light/70 text-sm truncate">
                    {user.email}
                  </p>
                </div>

                {/* 메뉴 항목들 */}
                <button
                  onClick={() => {
                    router.push('/history');
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-coffee-light hover:bg-coffee-gold/20 transition-colors flex items-center space-x-2"
                >
                  <span>📊</span>
                  <span>내 기록</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-coffee-light hover:bg-red-500/20 transition-colors flex items-center space-x-2"
                >
                  <span>🚪</span>
                  <span>로그아웃</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="w-full px-4 py-2 text-left text-coffee-light hover:bg-coffee-gold/20 transition-colors flex items-center space-x-2"
                >
                  <span>🔑</span>
                  <span>로그인</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/record/photo');
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-coffee-light hover:bg-coffee-gold/20 transition-colors flex items-center space-x-2"
                >
                  <span>🎁</span>
                  <span>무료 체험</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <AlertComponent />
    </>
  );
}