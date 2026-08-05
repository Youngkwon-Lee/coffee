"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, getAdditionalUserInfo } from "firebase/auth";
import { auth, db } from "@/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useCustomAlert } from "../components/CustomAlert";
import { createGoogleSignInProvider, getGoogleSignInErrorMessage } from "@/utils/firebaseAuth";
import Link from "next/link";
import { Coffee, Sparkles, Cpu, Database, BarChart3, Cloud, ChevronLeft, ArrowRight } from "lucide-react";

type FirebaseAuthErrorLike = {
  code?: string;
};

export default function LoginPage() {
  const [user, loading] = useAuthState(auth);
  const { showAlert, AlertComponent } = useCustomAlert();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [trialData, setTrialData] = useState<Record<string, unknown> | null>(null);
  const [loginMethod, setLoginMethod] = useState<'social' | 'email'>('social');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // 로그인 상태면 메인 페이지로 리다이렉트
    if (user) {
      router.push("/");
      return;
    }

    // 체험 모드 데이터 확인
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem("coffee_trial_data");
      if (savedData) {
        try {
          setTrialData(JSON.parse(savedData));
        } catch (error) {
          console.error("체험 데이터 파싱 오류:", error);
        }
      }
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    
    try {
      const provider = createGoogleSignInProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isNewUser = !!getAdditionalUserInfo(result)?.isNewUser;

      showAlert({
        type: 'success',
        title: '로그인 성공!',
        message: `환영합니다, ${user.displayName}님!\n\n이제 무제한으로 AI 분석을 이용하실 수 있어요! ☕`,
        confirmText: '시작하기'
      });

      // 체험 데이터가 있다면 실제 데이터베이스에 저장
      if (trialData && user) {
        try {
          await addDoc(collection(db, "users", user.uid, "records"), {
            ...trialData,
            createdAt: Timestamp.now()
          });
          
          // 체험 데이터 및 카운트 삭제
          localStorage.removeItem("coffee_trial_data");
          localStorage.removeItem("coffee_trial_count");
          
          showAlert({
            type: 'success',
            title: '데이터 저장 완료',
            message: '체험 중에 분석한 커피 정보가 성공적으로 저장되었습니다!',
            confirmText: '확인'
          });
        } catch (error) {
          console.error("체험 데이터 저장 오류:", error);
        }
      }

      // 신규 유저는 온보딩으로 이동
      setTimeout(() => {
        router.push(isNewUser ? "/onboarding" : "/");
      }, 1500);

    } catch (error) {
      console.error("로그인 오류:", error);
      
      showAlert({
        type: 'error',
        title: '로그인 실패',
        message: getGoogleSignInErrorMessage(error),
        confirmText: '확인'
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);

    try {
      // 회원가입 시 비밀번호 확인
      if (!isLogin && password !== confirmPassword) {
        showAlert({
          type: 'error',
          title: '비밀번호 불일치',
          message: '비밀번호가 일치하지 않습니다.',
          confirmText: '확인'
        });
        return;
      }

      let result;
      if (isLogin) {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }

      const user = result.user;
      const isNewSignup = !isLogin;

      showAlert({
        type: 'success',
        title: isLogin ? '로그인 성공!' : '회원가입 성공!',
        message: `환영합니다!\n\n이제 무제한으로 AI 분석을 이용하실 수 있어요! ☕`,
        confirmText: '시작하기'
      });

      // 체험 데이터가 있다면 실제 데이터베이스에 저장
      if (trialData && user) {
        try {
          await addDoc(collection(db, "users", user.uid, "records"), {
            ...trialData,
            createdAt: Timestamp.now()
          });
          
          localStorage.removeItem("coffee_trial_data");
          localStorage.removeItem("coffee_trial_count");
          
          showAlert({
            type: 'success',
            title: '데이터 저장 완료',
            message: '체험 중에 분석한 커피 정보가 성공적으로 저장되었습니다!',
            confirmText: '확인'
          });
        } catch (error) {
          console.error("체험 데이터 저장 오류:", error);
        }
      }

      setTimeout(() => {
        router.push(isNewSignup ? "/onboarding" : "/");
      }, 1500);

    } catch (error) {
      console.error(`${isLogin ? '로그인' : '회원가입'} 오류:`, error);
      const authError = error as FirebaseAuthErrorLike;
      
      let errorMessage = `${isLogin ? '로그인' : '회원가입'} 중 오류가 발생했습니다.`;
      if (authError.code === 'auth/user-not-found') {
        errorMessage = '존재하지 않는 계정입니다.';
      } else if (authError.code === 'auth/wrong-password') {
        errorMessage = '비밀번호가 올바르지 않습니다.';
      } else if (authError.code === 'auth/email-already-in-use') {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (authError.code === 'auth/weak-password') {
        errorMessage = '비밀번호는 6자 이상이어야 합니다.';
      } else if (authError.code === 'auth/invalid-email') {
        errorMessage = '올바르지 않은 이메일 형식입니다.';
      }
      
      showAlert({
        type: 'error',
        title: `${isLogin ? '로그인' : '회원가입'} 실패`,
        message: errorMessage,
        confirmText: '다시 시도'
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleKakaoLogin = async () => {
    // 카카오 로그인은 웹 환경에서 직접 구현이 복잡하므로 
    // 현재는 알림만 표시하고 추후 구현 예정으로 안내
    showAlert({
      type: 'warning',
      title: '카카오 로그인',
      message: '카카오 로그인은 현재 준비 중입니다.\n\nGoogle 로그인 또는 이메일 로그인을 이용해주세요!',
      confirmText: '확인'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-coffee-dark">
        <div className="loading-spinner w-8 h-8 rounded-full border-2 border-coffee-gold border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-coffee-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-coffee-gold/10 border border-coffee-gold/20 flex items-center justify-center text-coffee-gold shadow-lg shadow-coffee-gold/5">
              <Coffee className="w-7 h-7 stroke-[1.8]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-coffee-light mb-2">
            커피 트래커
          </h1>
          <p className="text-coffee-light/60 text-sm">
            AI로 더 스마트하게 커피를 기록하세요
          </p>
        </div>

        {/* 체험 데이터 알림 */}
        {trialData && (
          <div className="card-coffee border-coffee-gold/30 p-4 mb-6 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-coffee-gold shrink-0 mt-0.5" />
            <div>
              <h3 className="text-coffee-light font-semibold text-sm">
                체험 데이터가 있습니다!
              </h3>
              <p className="text-coffee-light/70 text-xs mt-0.5">
                로그인하시면 분석한 커피 정보를 저장할 수 있어요
              </p>
            </div>
          </div>
        )}

        {/* 로그인 카드 */}
        <div className="card-coffee p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* 로그인 방법 선택 탭 */}
          <div className="flex rounded-xl bg-coffee-dark/50 border border-coffee-gold/10 p-1 mb-6">
            <button
              onClick={() => setLoginMethod('social')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                loginMethod === 'social'
                  ? 'bg-coffee-gold text-coffee-dark font-semibold shadow-md shadow-coffee-gold/10'
                  : 'text-coffee-light/60 hover:text-coffee-gold hover:bg-white/[0.02]'
              }`}
            >
              소셜 로그인
            </button>
            <button
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                loginMethod === 'email'
                  ? 'bg-coffee-gold text-coffee-dark font-semibold shadow-md shadow-coffee-gold/10'
                  : 'text-coffee-light/60 hover:text-coffee-gold hover:bg-white/[0.02]'
              }`}
            >
              이메일 로그인
            </button>
          </div>

          {loginMethod === 'social' ? (
            /* 소셜 로그인 섹션 */
            <div className="space-y-3">
              {/* Google 로그인 버튼 */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/90 hover:text-white font-medium py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group hover:-translate-y-0.5"
              >
                {isSigningIn ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>
                  {isSigningIn ? '로그인 중...' : 'Google로 로그인'}
                </span>
              </button>

              {/* 카카오 로그인 버튼 */}
              <button
                onClick={handleKakaoLogin}
                disabled={isSigningIn}
                className="w-full border border-[#FEE500]/25 bg-[#FEE500]/[0.03] hover:bg-[#FEE500]/[0.08] text-[#FEE500]/90 hover:text-[#FEE500] font-medium py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.265.98-.957 3.535-1.096 4.09-.17.68.25.672.525.49 2.148-1.427 4.148-2.775 4.148-2.775.378.077.77.12 1.153.12 4.97 0 9-3.186 9-7.115C21 6.185 16.97 3 12 3z"/>
                </svg>
                <span>카카오로 로그인</span>
              </button>
            </div>
          ) : (
            /* 이메일 로그인 섹션 */
            <div>
              {/* 로그인/회원가입 토글 */}
              <div className="flex justify-center mb-6">
                <div className="flex bg-coffee-dark/50 border border-coffee-gold/10 rounded-lg p-1">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${
                      isLogin
                        ? 'bg-coffee-gold text-coffee-dark font-semibold'
                        : 'text-coffee-light/60 hover:text-coffee-gold'
                    }`}
                  >
                    로그인
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${
                      !isLogin
                        ? 'bg-coffee-gold text-coffee-dark font-semibold'
                        : 'text-coffee-light/60 hover:text-coffee-gold'
                    }`}
                  >
                    회원가입
                  </button>
                </div>
              </div>

              {/* 이메일 로그인 폼 */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="이메일 주소"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-coffee-dark/60 border border-coffee-gold/20 rounded-xl text-coffee-light placeholder-coffee-light/30 focus:outline-none focus:border-coffee-gold/60 focus:ring-1 focus:ring-coffee-gold/40 transition-all duration-300 text-sm"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-coffee-dark/60 border border-coffee-gold/20 rounded-xl text-coffee-light placeholder-coffee-light/30 focus:outline-none focus:border-coffee-gold/60 focus:ring-1 focus:ring-coffee-gold/40 transition-all duration-300 text-sm"
                  />
                </div>
                {!isLogin && (
                  <div>
                    <input
                      type="password"
                      placeholder="비밀번호 확인"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-coffee-dark/60 border border-coffee-gold/20 rounded-xl text-coffee-light placeholder-coffee-light/30 focus:outline-none focus:border-coffee-gold/60 focus:ring-1 focus:ring-coffee-gold/40 transition-all duration-300 text-sm"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full bg-coffee-gold hover:bg-coffee-gold/90 text-coffee-dark font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-md shadow-coffee-gold/10 text-sm"
                >
                  {isSigningIn ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
                </button>
              </form>
            </div>
          )}

          {/* 로그인 혜택 */}
          <div className="bg-coffee-dark/30 border border-coffee-gold/5 rounded-xl p-4 mt-6 mb-6 space-y-3">
            <h3 className="text-coffee-light font-semibold text-sm">
              로그인하면 이런 혜택이 있어요:
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="flex items-center gap-3 text-coffee-light/75 text-sm">
                <div className="w-7 h-7 rounded-lg bg-coffee-gold/5 border border-coffee-gold/15 flex items-center justify-center text-coffee-gold shrink-0">
                  <Cpu className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span>AI 분석 무제한 이용</span>
              </div>
              <div className="flex items-center gap-3 text-coffee-light/75 text-sm">
                <div className="w-7 h-7 rounded-lg bg-coffee-gold/5 border border-coffee-gold/15 flex items-center justify-center text-coffee-gold shrink-0">
                  <Database className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span>커피 기록 자동 저장</span>
              </div>
              <div className="flex items-center gap-3 text-coffee-light/75 text-sm">
                <div className="w-7 h-7 rounded-lg bg-coffee-gold/5 border border-coffee-gold/15 flex items-center justify-center text-coffee-gold shrink-0">
                  <BarChart3 className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span>상세한 분석 및 통계</span>
              </div>
              <div className="flex items-center gap-3 text-coffee-light/75 text-sm">
                <div className="w-7 h-7 rounded-lg bg-coffee-gold/5 border border-coffee-gold/15 flex items-center justify-center text-coffee-gold shrink-0">
                  <Cloud className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span>모든 기기에서 동기화</span>
              </div>
            </div>
          </div>

          {/* 개인정보 안내 */}
          <div className="text-center">
            <p className="text-coffee-light/40 text-[11px] leading-relaxed">
              로그인 시 Google 계정의 기본 정보(이름, 이메일)만 사용하며,<br/>
              개인정보는 안전하게 보호됩니다.
            </p>
          </div>
        </div>

        {/* 체험 모드 링크 */}
        <div className="text-center mt-6">
          <Link 
            href="/record/photo" 
            className="inline-flex items-center gap-2 text-coffee-gold hover:text-coffee-gold/80 text-sm transition-all duration-300 font-medium group"
          >
            <Sparkles className="w-4 h-4 stroke-[1.8] transition-transform group-hover:rotate-12" />
            <span>로그인 없이 체험해보기</span>
            <ArrowRight className="w-4 h-4 stroke-[1.8] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </Link>
        </div>

        {/* 뒤로가기 */}
        <div className="text-center mt-5">
          <Link 
            href="/" 
            className="text-coffee-light/50 hover:text-coffee-light text-xs transition-all duration-300 inline-flex items-center gap-1.5 group"
          >
            <ChevronLeft className="w-4 h-4 stroke-[1.8] transition-transform group-hover:-translate-x-1" />
            메인으로 돌아가기
          </Link>
        </div>
      </div>

      <AlertComponent />
    </div>
  );
} 
