import { NextRequest, NextResponse } from 'next/server';

// OpenAI vision 호출 대비 (기본 함수 타임아웃 초과 방지)
export const maxDuration = 60;

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'glm-ocr';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini';

const EXTRACT_PROMPT = `
Extract the following information from this coffee-related image (such as a coffee bean bag, cafe menu, or receipt) and output the result STRICTLY as a JSON object.

The JSON should have these exact keys:
- "cafe": The name of the cafe or roastery (string, or empty string if not found)
- "bean": The name of the coffee bean or blend (string, or empty string if not found)
- "origin": The country or region of origin (string, or empty string)
- "processing": The processing method like "Washed", "Natural", "Honey", etc. (string, or empty string)
- "roast_level": The roasting level like "Light", "Medium", "Dark" (string, or empty string)
- "flavor": An array of flavor notes/tasting notes (array of strings, or empty array)

Korean text in the image should be kept in Korean. Do not include any explanation or markdown formatting outside the JSON object. Output ONLY the JSON.
`;

const TEXT_PROMPT =
  'Transcribe all visible text in this image as plain text, preserving line breaks. Korean text stays in Korean. Output only the transcription.';

async function callOpenAIVision(
  prompt: string,
  base64: string,
  mimeType: string,
  jsonMode: boolean
): Promise<string> {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(
  prompt: string,
  images?: string[],
  timeoutMs = 120000
): Promise<string> {
  const payload: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    format: 'json',
    options: { temperature: 0.1, num_ctx: 2048 },
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
    const mimeType = file.type || 'image/jpeg';

    const useOpenAI = Boolean(OPENAI_API_KEY);
    const source = useOpenAI ? 'openai-vision' : 'glm-ocr';

    if (mode === 'text') {
      const text = useOpenAI
        ? await callOpenAIVision(TEXT_PROMPT, base64, mimeType, false)
        : await callOllama(TEXT_PROMPT, [base64]);
      return NextResponse.json({ text, confidence: 0.9, source });
    }

    const rawResponse = useOpenAI
      ? await callOpenAIVision(EXTRACT_PROMPT, base64, mimeType, true)
      : await callOllama(EXTRACT_PROMPT, [base64]);

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawResponse.trim());
    } catch (e) {
      console.warn(`Failed to parse ${source} JSON response:`, rawResponse);
    }

    return NextResponse.json({
      cafe: parsed.cafe || '',
      bean: parsed.bean || '',
      origin: parsed.origin || '',
      processing: parsed.processing || '',
      flavor: Array.isArray(parsed.flavor) ? parsed.flavor : [],
      roast_level: parsed.roast_level || '',
      confidence: parsed.bean ? 0.9 : 0.5,
      raw_text: rawResponse,
      source,
    });
  } catch (error) {
    console.error('OCR API error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    return NextResponse.json(
      {
        error: 'OCR failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (OPENAI_API_KEY) {
    return NextResponse.json({
      status: 'ok',
      source: 'openai-vision',
      model: OPENAI_MODEL,
    });
  }

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
