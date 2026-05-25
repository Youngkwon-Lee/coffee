import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildShareCaption,
  type ShareCaptionTone,
  type SharePayload,
  type ShareTemplate,
  type ShareVisibility,
} from "../../utils/share";

type CaptionRequestBody = {
  payload?: SharePayload;
  visibility?: ShareVisibility;
  template?: ShareTemplate;
  tone?: ShareCaptionTone;
};

const toneGuide: Record<ShareCaptionTone, string> = {
  journal: "담백하고 기록적인 톤. 과장 없이 깔끔하게 정리합니다.",
  mood: "인스타 감성 톤. 여운, 분위기, 장면감을 살리되 과한 이모지는 피합니다.",
  promo: "공유/추천 톤. 저장하고 가보고 싶게 만드는 소개형 문장으로 씁니다.",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CaptionRequestBody;
    const payload = body.payload;
    const visibility = body.visibility;
    const template = body.template || "minimal";
    const tone = body.tone || "journal";

    if (!payload || !visibility) {
      return NextResponse.json({ error: "payload와 visibility가 필요합니다." }, { status: 400 });
    }

    const fallbackCaption = buildShareCaption(payload, visibility, template, tone);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        caption: fallbackCaption,
        source: "rule-based-fallback",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "너는 커피 기록을 SNS용 캡션으로 다듬는 카피라이터다. 한국어로만 작성하고, 과장된 마케팅 문구보다 자연스럽고 공유하기 좋은 문장을 우선한다.",
        },
        {
          role: "user",
          content: `
다음 커피 기록을 SNS 캡션으로 다시 써줘.

톤 가이드:
${toneGuide[tone]}

제약:
- 한국어로 4~7줄
- 해시태그는 마지막 줄 1개로만
- 정보가 없는 내용은 지어내지 말 것
- 카페명, 원두명, 향미를 가능한 한 자연스럽게 포함
- 템플릿 이름은 직접 언급하지 말 것

기록 정보:
- 카페명: ${payload.cafe}
- 원두명: ${payload.title}
- 추출/가공/서브타이틀: ${payload.subtitle}
- 평점: ${visibility.showRating ? payload.rating.toFixed(1) : "비표시"}
- 향미: ${visibility.showFlavors ? payload.flavors.join(", ") || "없음" : "비표시"}
- 원산지: ${payload.originLabel || "없음"}
- 로스팅: ${payload.roastLabel || "없음"}
- 위치: ${visibility.showLocation ? payload.locationLabel : "비표시"}
- 날짜: ${visibility.showDate ? payload.dateLabel : "비표시"}
- 메모: ${visibility.showReview ? payload.review || "없음" : "비표시"}

기본 캡션 참고:
${fallbackCaption}
          `.trim(),
        },
      ],
    });

    const caption = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({
      caption: caption || fallbackCaption,
      source: caption ? "openai" : "rule-based-fallback",
    });
  } catch (error) {
    console.error("Share caption generation failed:", error);
    return NextResponse.json(
      {
        error: "AI 캡션 생성에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "POST 메서드만 지원됩니다." }, { status: 405 });
}
