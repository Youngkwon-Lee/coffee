import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'glm-ocr';

async function callOllama(
  prompt: string,
  images?: string[],
  timeoutMs = 120000
): Promise<string> {
  const payload: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.01, num_ctx: 2048 },
  };
  if (images) payload.images = images;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // ngrok free tier requires this header to skip browser warning
  if (OLLAMA_HOST.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const resp = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Ollama ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.response || '';
}

/** Regex-based extraction from OCR text for common coffee label fields */
function parseFromText(text: string) {
  const get = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return '';
  };

  const cafe = get([
    /(?:로스터[리스]|커피\s*로스터[리스]).*?[:\s]+(.+)/i,
  ]);

  const bean = get([
    /품\s*명[:\s]+(.+)/i,
    /bean\s*name[:\s]+(.+)/i,
  ]);

  const origin = get([
    /^원산지[:\s]+(.+)/im,
    /^origin[:\s]+(.+)/im,
  ]);

  const processingMatch = text.match(
    /(?:가공\s*방식|process(?:ing)?)[:\s]+(.+)/i
  );
  let processing = processingMatch ? processingMatch[1].trim() : '';
  // Normalize to standard names
  const processMap: Record<string, string> = {
    '워시드': 'Washed', '수세식': 'Washed', washed: 'Washed',
    '내추럴': 'Natural', '건조식': 'Natural', natural: 'Natural',
    '허니': 'Honey', honey: 'Honey',
    '혐기성': 'Anaerobic', anaerobic: 'Anaerobic',
  };
  for (const [k, v] of Object.entries(processMap)) {
    if (processing.toLowerCase().includes(k)) { processing = v; break; }
  }

  const roastMatch = text.match(
    /(?:로스팅|로스[팀틴테]|roast(?:ing)?)[:\s]+(.+)/i
  );
  let roast_level = roastMatch ? roastMatch[1].trim() : '';
  // Normalize roast level
  const roastMap: Record<string, string> = {
    'light': 'Light', '라이트': 'Light',
    'medium light': 'Medium-Light', '미디엄 라이트': 'Medium-Light', '미디엘 라이트': 'Medium-Light',
    'medium dark': 'Medium-Dark', '미디엄 다크': 'Medium-Dark',
    'medium': 'Medium', '미디엄': 'Medium',
    'dark': 'Dark', '다크': 'Dark',
  };
  for (const [k, v] of Object.entries(roastMap)) {
    if (roast_level.toLowerCase().includes(k)) { roast_level = v; break; }
  }

  const variety = get([
    /품\s*종[:\s]+(.+)/i,
    /variety[:\s]+(.+)/i,
  ]);

  // Grab last known cafe name pattern (footer of Korean labels)
  const footerCafe = text.match(/^(.+(?:커피|로스터[리스]|Coffee|Roasters).*)$/im);
  const cafeName = cafe || (footerCafe ? footerCafe[1].trim() : '');

  return { cafe: cafeName, bean, origin, processing, roast_level, variety };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const mode = (formData.get('mode') as string) || 'coffee';

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Step 1: Raw OCR text extraction from image
    const rawText = await callOllama(
      'OCR this image. Extract all visible text exactly as it appears.',
      [base64]
    );

    if (mode === 'text') {
      return NextResponse.json({
        text: rawText,
        confidence: 0.9,
        source: 'glm-ocr',
      });
    }

    // Step 2 (coffee mode): Parse structured data from OCR text
    const parsed = parseFromText(rawText);

    return NextResponse.json({
      cafe: parsed.cafe,
      bean: parsed.bean,
      origin: parsed.origin,
      processing: parsed.processing,
      flavor: [] as string[],
      roast_level: parsed.roast_level,
      confidence: parsed.bean ? 0.85 : 0.5,
      raw_text: rawText,
      source: 'glm-ocr',
    });
  } catch (error) {
    console.error('GLM-OCR API error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: 'GLM-OCR failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const headers: Record<string, string> = {};
    if (OLLAMA_HOST.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return NextResponse.json({ status: 'error', message: 'Ollama not responding' }, { status: 503 });
    }
    const data = await resp.json();
    const models = (data.models || []).map((m: any) => m.name);
    const hasModel = models.some((m: string) => m === OLLAMA_MODEL || m.startsWith(`${OLLAMA_MODEL}:`));
    return NextResponse.json({
      status: hasModel ? 'ok' : 'model_not_found',
      ollama: 'connected',
      model: OLLAMA_MODEL,
      available_models: models,
    });
  } catch {
    return NextResponse.json({ status: 'error', message: 'Cannot connect to Ollama' }, { status: 503 });
  }
}
