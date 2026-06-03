import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SensoryScenePreset, SharePayload, ShareVisibility } from "../../utils/share";

type StylePreset = "editorial" | "sticker" | "cinematic";
type ImageProvider = "openai" | "gemini";
type GeminiImageModel = "gemini-3-pro-image" | "gemini-3.1-flash-image" | "gemini-2.5-flash-image";
type OpenAiImageModel = "gpt-image-1.5" | "gpt-image-1";

type ShareStyleImageRequestBody = {
  payload?: SharePayload;
  visibility?: ShareVisibility;
  stylePreset?: StylePreset;
  scenePreset?: SensoryScenePreset;
  provider?: ImageProvider;
  model?: GeminiImageModel | OpenAiImageModel;
};

const OPENAI_DEFAULT_MODEL: OpenAiImageModel = "gpt-image-1.5";
const GEMINI_DEFAULT_MODEL: GeminiImageModel = "gemini-3-pro-image";

const presetGuides: Record<StylePreset, string> = {
  editorial:
    "세련된 매거진 화보 스타일. 커피 사진을 중심으로 따뜻한 베이지/브라운 톤, 고급스러운 여백감, 차분한 조명과 질감을 살립니다.",
  sticker:
    "SNS 스토리 스타일. 부드러운 오버레이와 캡슐형 장식이 얹힌 듯한 감성 편집본처럼 보이게 하되, 장식은 추상적이어야 하고 읽히는 글자는 만들지 않습니다.",
  cinematic:
    "시네마틱 포스터 스타일. 깊이 있는 명암, 필름 같은 분위기, 인상적인 한 장면의 무드를 살립니다.",
};

const scenePresetGuides: Record<SensoryScenePreset, string> = {
  auto: "원산지, 가공방식, 향미를 참고해 가장 자연스러운 장면 톤을 선택합니다.",
  "kenya-clarity": "차갑고 또렷한 공기, 밝은 반사, 하이클래리티 berry lift.",
  "fruit-bloom": "sunset fruit bloom, floral haze, pink-red diffusion, dreamy warmth.",
  "amber-nectar": "honeyed amber glow, syrupy motion, golden nectar atmosphere.",
  "velvet-night": "deeper shadows, cocoa warmth, smoky velvet night atmosphere.",
};

function buildStylePrompt(
  payload: SharePayload,
  visibility: ShareVisibility,
  stylePreset: StylePreset,
  scenePreset: SensoryScenePreset,
) {
  return `
원본 커피 사진을 바탕으로 SNS 공유용 세로형 카드의 "배경 스타일 이미지"를 만들어줘.
이 이미지는 최종 결과물이 아니라, 이후 앱이 정확한 텍스트 오버레이를 다시 얹을 베이스 이미지다.

스타일 가이드:
${presetGuides[stylePreset]}

감각 프리셋:
${scenePresetGuides[scenePreset]}

반드시 지킬 점:
- 원본 사진의 피사체와 구도를 최대한 존중
- 과도한 합성 느낌보다 자연스럽고 완성도 높은 편집 결과
- 실제 기록 정보는 참고만 하고, 최종 이미지 안에 직접 읽히는 텍스트를 넣지 말 것
- 화면 비율은 9:16 세로형 소셜 스토리
- 커피 사진이 주인공이어야 하며, 과도한 장식은 피할 것
- 전체 결과는 실제 서비스에서 바로 공유할 수 있는 polished background mockup처럼 보여야 함

절대 하지 말 것:
- 새로운 제목, 캡션, 문장, 숫자, 한글, 영문, 로고, 워터마크, UI 텍스트를 생성하지 말 것
- 배경에 커다란 가짜 타이포그래피를 넣지 말 것
- 원본에 인쇄된 글자를 다른 읽히는 글자로 바꿔치기하지 말 것
- 랜덤한 한글/영문 조합, 깨진 문자, 의미 없는 알파벳을 만들지 말 것

텍스트 처리 원칙:
- 원본 사진에 이미 있는 글자는 그대로 두거나, 필요하면 더 추상적이고 덜 읽히게 정리할 것
- 읽히는 새 텍스트를 추가하는 대신, 비어 있는 네거티브 스페이스와 분위기만 만들어줄 것
- 상단과 하단 일부에는 앱이 텍스트를 얹을 수 있도록 비교적 차분한 공간을 남겨둘 것

참고 기록 정보:
- 카페명: ${payload.cafe}
- 원두명: ${payload.title}
- 서브타이틀: ${payload.subtitle}
- 평점: ${visibility.showRating && payload.rating > 0 ? payload.rating.toFixed(1) : "표시 안 함"}
- 향미: ${visibility.showFlavors ? payload.flavors.join(", ") || "없음" : "표시 안 함"}
- 날짜: ${visibility.showDate ? payload.dateLabel : "표시 안 함"}
- 위치: ${visibility.showLocation ? payload.locationLabel : "표시 안 함"}
- 메모: ${visibility.showReview ? payload.review || "없음" : "표시 안 함"}
- 원산지/로스트: ${[payload.originLabel, payload.roastLabel].filter(Boolean).join(" · ") || "없음"}

장면별 힌트:
- 인물/카페 사진이면 표정, 컵, 배경 보케, 따뜻한 조명을 살릴 것
- 원두 카드/패키지 사진이면 손, 카드, 테이블 질감, 실물 느낌을 유지할 것
- 장식 요소는 가능하지만, 모두 추상적이어야 하고 읽히는 텍스트처럼 보이면 안 됨
  `.trim();
}

function resolveProvider(requested?: ImageProvider) {
  if (requested === "gemini") {
    return process.env.GEMINI_API_KEY ? "gemini" : null;
  }

  if (requested === "openai") {
    return process.env.OPENAI_API_KEY ? "openai" : null;
  }

  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function loadSourceImage(payload: SharePayload) {
  const sourceResponse = await fetch(payload.imageUrl);
  if (!sourceResponse.ok) {
    throw new Error(`원본 이미지를 불러오지 못했습니다. (${sourceResponse.status} ${sourceResponse.statusText})`);
  }

  const sourceType = sourceResponse.headers.get("content-type") || "image/jpeg";
  const sourceBytes = await sourceResponse.arrayBuffer();
  return {
    sourceType,
    sourceBytes,
  };
}

async function generateWithOpenAI(args: {
  model: OpenAiImageModel;
  prompt: string;
  payload: SharePayload;
  sourceType: string;
  sourceBytes: ArrayBuffer;
}) {
  const sourceFile = new File([args.sourceBytes], "coffee-source.jpg", { type: args.sourceType });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageResponse = await openai.images.edit({
    model: args.model,
    image: sourceFile,
    prompt: args.prompt,
    quality: "low",
    size: "1024x1536",
    background: "opaque",
    n: 1,
    user: args.payload.title.slice(0, 64),
  });

  const imageBase64 = imageResponse.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("OpenAI가 이미지를 반환하지 않았습니다.");
  }

  return {
    imageDataUrl: `data:image/png;base64,${imageBase64}`,
    usage: imageResponse.usage || null,
  };
}

async function generateWithGemini(args: {
  model: GeminiImageModel;
  prompt: string;
  sourceType: string;
  sourceBytes: ArrayBuffer;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${args.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: args.prompt },
              {
                inlineData: {
                  mimeType: args.sourceType,
                  data: Buffer.from(args.sourceBytes).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          responseFormat: {
            image: {
              aspectRatio: "9:16",
              imageSize: "2K",
            },
          },
        },
      }),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const details =
      result?.error?.message ||
      result?.error?.status ||
      result?.error ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Gemini 이미지 생성 실패: ${details}`);
  }

  const parts = result?.candidates?.[0]?.content?.parts;
  const imagePart = Array.isArray(parts)
    ? parts.find((part: { inlineData?: { data?: string; mimeType?: string } }) => typeof part?.inlineData?.data === "string")
    : null;
  const imageBase64 = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType || "image/png";

  if (!imageBase64) {
    throw new Error("Gemini가 이미지를 반환하지 않았습니다.");
  }

  return {
    imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
    usage: result?.usageMetadata || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ShareStyleImageRequestBody;
    const payload = body.payload;
    const visibility = body.visibility;
    const stylePreset = body.stylePreset || "editorial";
    const scenePreset = body.scenePreset || "auto";

    if (!payload || !visibility) {
      return NextResponse.json({ error: "payload와 visibility가 필요합니다." }, { status: 400 });
    }

    const provider = resolveProvider(body.provider);
    if (!provider) {
      return NextResponse.json(
        {
          error:
            body.provider === "gemini"
              ? "GEMINI_API_KEY가 설정되지 않았습니다."
              : body.provider === "openai"
                ? "OPENAI_API_KEY가 설정되지 않았습니다."
                : "이미지 생성용 API 키가 없습니다. GEMINI_API_KEY 또는 OPENAI_API_KEY가 필요합니다.",
        },
        { status: 503 },
      );
    }

    const prompt = buildStylePrompt(payload, visibility, stylePreset, scenePreset);
    const { sourceType, sourceBytes } = await loadSourceImage(payload);

    if (provider === "gemini") {
      const model = (body.model as GeminiImageModel | undefined) || GEMINI_DEFAULT_MODEL;
      const result = await generateWithGemini({
        model,
        prompt,
        sourceType,
        sourceBytes,
      });

      return NextResponse.json({
        ...result,
        provider,
        model,
        stylePreset,
        scenePreset,
      });
    }

    const model = (body.model as OpenAiImageModel | undefined) || OPENAI_DEFAULT_MODEL;
    const result = await generateWithOpenAI({
      model,
      prompt,
      payload,
      sourceType,
      sourceBytes,
    });

    return NextResponse.json({
      ...result,
      provider,
      model,
      stylePreset,
      scenePreset,
    });
  } catch (error) {
    console.error("Share style image generation failed:", error);
    return NextResponse.json(
      {
        error: "AI 스타일 카드 생성에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    error: "POST 메서드만 지원됩니다.",
    supportedProviders: ["gemini", "openai"],
    defaultProvider: process.env.GEMINI_API_KEY ? "gemini" : process.env.OPENAI_API_KEY ? "openai" : null,
    defaultModels: {
      gemini: GEMINI_DEFAULT_MODEL,
      openai: OPENAI_DEFAULT_MODEL,
    },
  }, { status: 405 });
}
