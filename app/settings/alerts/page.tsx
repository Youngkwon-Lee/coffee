'use client';
import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import { db, auth } from '@/firebase';
import { createGoogleSignInProvider, getGoogleSignInErrorMessage } from '@/utils/firebaseAuth';
import { premiumState, premiumUntilMillis, parsePremiumRequest, PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS, type PremiumRequest } from '@/lib/premium';
import AlertSettingsView from './AlertSettingsView';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'wondooradar_bot';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default function AlertSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [request, setRequest] = useState<PremiumRequest | null>(null);
  const [legacyRequest, setLegacyRequest] = useState(false);
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadProfile = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [userSnap, requestSnap, configSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)), getDoc(doc(db, 'premium_requests', uid)), getDoc(doc(db, 'premium_config', 'pilot')).catch(() => null),
      ]);
      if (auth.currentUser?.uid !== uid) return;
      setProfile(userSnap.data() ?? {});
      const parsed = parsePremiumRequest(requestSnap.data());
      setRequest(parsed);
      setLegacyRequest(requestSnap.exists() && !parsed);
      setSalesEnabled(configSnap?.data()?.salesEnabled === true);
      setNow(Date.now());
    } catch {
      if (auth.currentUser?.uid !== uid) return;
      setSalesEnabled(false);
      setError('알림 정보를 불러오지 못했습니다. 연결과 신청 상태를 다시 확인해 주세요.');
    } finally {
      if (auth.currentUser?.uid === uid) setLoading(false);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setProfile({}); setRequest(null); setLegacyRequest(false); setSalesEnabled(false);
    setLinkCode(null); setNotice(null); setError(null);
    if (current) void loadProfile(current.uid); else setLoading(false);
  }), [loadProfile]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const login = async () => {
    setBusy(true); setError(null);
    try { await signInWithPopup(auth, createGoogleSignInProvider()); }
    catch (e) { setError(getGoogleSignInErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const connect = async () => {
    if (!user) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const code = Array.from(crypto.getRandomValues(new Uint32Array(6))).map(n => ALPHABET[n % ALPHABET.length]).join('');
      await setDoc(doc(db, 'telegram_link_codes', code), { uid: user.uid, createdAt: serverTimestamp() });
      if (auth.currentUser?.uid === user.uid) setLinkCode(code);
    } catch { setError('연결 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const requestPremium = async () => {
    if (!user || !salesEnabled || !profile.telegramChatId || ['pending', 'awaiting_payment'].includes(request?.status ?? '')) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const requestId = crypto.randomUUID();
      await setDoc(doc(db, 'premium_requests', user.uid), {
        uid: user.uid, requestId, status: 'pending', requestedAt: serverTimestamp(),
        priceKrw: PREMIUM_PRICE_KRW, periodDays: PREMIUM_PERIOD_DAYS, currency: 'KRW',
      });
      if (auth.currentUser?.uid !== user.uid) return;
      setRequest({ requestId, status: 'pending' }); setLegacyRequest(false);
      setNotice('신청이 접수되었습니다. 자동으로 결제되지 않습니다.');
    } catch { setError('신청을 접수하지 못했습니다. 접수 가능 여부와 신청 상태를 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  return <AlertSettingsView authenticated={Boolean(user)} loading={loading} error={error} notice={notice}
    linked={Boolean(profile.telegramChatId)} state={premiumState(profile, now)} expiresAt={premiumUntilMillis(profile)}
    request={request} legacyRequest={legacyRequest} salesEnabled={salesEnabled} busy={busy}
    linkCode={linkCode} deepLink={linkCode ? `https://t.me/${BOT_USERNAME}?start=${linkCode}` : null}
    onLogin={login} onConnect={connect} onRequest={requestPremium} onRefresh={() => user && void loadProfile(user.uid)} />;
}
