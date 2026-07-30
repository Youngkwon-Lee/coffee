import { NextRequest, NextResponse } from 'next/server';

// firebase-admin 사용 (telegram_link_codes 읽기/삭제는 관리자 권한 필요)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 연동 코드 유효 시간 (분)
const LINK_CODE_TTL_MINUTES = 30;

type TelegramChat = {
  id: number;
  type?: string;
};

type TelegramMessage = {
  chat?: TelegramChat;
  text?: string;
  from?: { id: number; first_name?: string; username?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'coffee-37b81'
  );
}

// scripts/sync-cafe-metadata.ts와 동일한 초기화 패턴
async function getAdminFirestore() {
  const adminApp = await import('firebase-admin/app');
  const adminFirestore = await import('firebase-admin/firestore');

  if (adminApp.getApps().length === 0) {
    const projectId = getProjectId();
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccount) {
      adminApp.initializeApp({
        credential: adminApp.cert(JSON.parse(serviceAccount)),
        projectId,
      });
    } else {
      adminApp.initializeApp({
        credential: adminApp.applicationDefault(),
        projectId,
      });
    }
  }

  return adminFirestore.getFirestore();
}

// 텔레그램 봇 API로 답장
async function replyToChat(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN 미설정 - 답장을 보내지 않습니다.');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('텔레그램 답장 실패:', error);
  }
}

// /start <code> 형태에서 연동 코드 추출
function extractStartCode(text?: string): string | null {
  if (!text) return null;

  const trimmed = text.trim();
  if (!trimmed.startsWith('/start')) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  const code = parts[1].trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

function isExpired(createdAt: unknown): boolean {
  if (!createdAt) return false;

  let createdMs: number | null = null;

  if (typeof createdAt === 'object' && createdAt !== null && 'toMillis' in createdAt) {
    createdMs = (createdAt as { toMillis: () => number }).toMillis();
  } else if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    createdMs = Number.isNaN(parsed) ? null : parsed;
  }

  if (createdMs === null) return false;

  return Date.now() - createdMs > LINK_CODE_TTL_MINUTES * 60 * 1000;
}

export async function POST(req: NextRequest) {
  // 텔레그램 웹훅 시크릿 검증 (setWebhook의 secret_token과 동일해야 함)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('TELEGRAM_WEBHOOK_SECRET 미설정 - 웹훅 요청을 처리하지 않습니다.');
    return NextResponse.json({ error: '웹훅이 설정되지 않았습니다.' }, { status: 503 });
  }

  const providedSecret = req.headers.get('x-telegram-bot-api-secret-token');

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  let update: TelegramUpdate;

  try {
    update = await req.json();
  } catch {
    // 잘못된 본문은 재시도할 필요가 없으므로 200으로 응답
    return NextResponse.json({ ok: true, ignored: 'invalid_body' });
  }

  const message = update.message || update.edited_message;
  const chatId = message?.chat?.id;

  if (!chatId) {
    return NextResponse.json({ ok: true, ignored: 'no_chat' });
  }

  const code = extractStartCode(message?.text);

  if (!code) {
    await replyToChat(
      chatId,
      '☕️ 원두레이더 봇입니다.\n웹사이트의 "알림 설정" 화면에서 연결 버튼을 눌러 접속해 주세요.'
    );
    return NextResponse.json({ ok: true, ignored: 'no_code' });
  }

  try {
    const db = await getAdminFirestore();
    const codeRef = db.collection('telegram_link_codes').doc(code);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      await replyToChat(chatId, '❌ 연결 코드를 찾을 수 없습니다. 웹사이트에서 코드를 다시 발급해 주세요.');
      return NextResponse.json({ ok: true, linked: false, reason: 'not_found' });
    }

    const codeData = codeSnap.data() || {};
    const uid = typeof codeData.uid === 'string' ? codeData.uid : '';

    if (!uid) {
      await codeRef.delete();
      await replyToChat(chatId, '❌ 연결 코드가 올바르지 않습니다. 코드를 다시 발급해 주세요.');
      return NextResponse.json({ ok: true, linked: false, reason: 'invalid_code' });
    }

    if (isExpired(codeData.createdAt)) {
      await codeRef.delete();
      await replyToChat(chatId, '⌛ 연결 코드가 만료되었습니다. 웹사이트에서 코드를 다시 발급해 주세요.');
      return NextResponse.json({ ok: true, linked: false, reason: 'expired' });
    }

    await db.collection('users').doc(uid).set(
      {
        telegramChatId: chatId,
        telegramLinkedAt: new Date(),
      },
      { merge: true }
    );

    await codeRef.delete();

    await replyToChat(
      chatId,
      '✅ 연결 완료!\n즐겨찾기한 원두의 재입고·가격 변동 소식을 이 채팅으로 보내드립니다.'
    );

    return NextResponse.json({ ok: true, linked: true });
  } catch (error) {
    console.error('텔레그램 연동 처리 실패:', error);
    await replyToChat(chatId, '⚠️ 연결 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    // 텔레그램이 무한 재시도하지 않도록 200으로 응답
    return NextResponse.json({ ok: true, linked: false, reason: 'error' });
  }
}

export async function GET() {
  // 헬스 체크용 (연동 상태는 노출하지 않음)
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
  });
}
