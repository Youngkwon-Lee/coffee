import type { NextRequest } from "next/server";
import { COFFEE_FUNNEL_EVENTS, type CoffeeFunnelOrigin } from "@/lib/coffeeFunnelEvents";
import { track } from "@vercel/analytics/server";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set<string>(COFFEE_FUNNEL_EVENTS);
const ALLOWED_ORIGINS = new Set<CoffeeFunnelOrigin>(["changes", "unattributed"]);

/**
 * Minimal anonymous counter backed by Vercel function runtime logs.
 * The request is never written to Firestore and user/session identifiers
 * are intentionally rejected. Logs are not a durable analytics warehouse.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") return new Response(null, { status: 415 });

  const length = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > 256) return new Response(null, { status: 413 });

  const requestOrigin = req.headers.get("origin");
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).host !== req.nextUrl.host) {
        return new Response(null, { status: 403 });
      }
    } catch {
      return new Response(null, { status: 403 });
    }
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return new Response(null, { status: 400 });
  }
  const fields = parsed as Record<string, unknown>;
  if (
    Object.keys(fields).length !== 2 ||
    typeof fields.event !== "string" ||
    !ALLOWED_EVENTS.has(fields.event) ||
    typeof fields.origin !== "string" ||
    !ALLOWED_ORIGINS.has(fields.origin as CoffeeFunnelOrigin)
  ) {
    return new Response(null, { status: 400 });
  }

  // Only two allowlisted, non-identifying categorical values are logged.
  console.info(`COFFEE_FUNNEL_V1 event=${fields.event} origin=${fields.origin}`);
  try {
    // An allowlisted, anonymous action count — not a user/conversion identifier.
    await track(`coffee_${fields.event}`, { origin: fields.origin });
  } catch {
    // Analytics failures must never block the original product action.
    console.warn("COFFEE_ANALYTICS_V1 delivery unavailable");
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
