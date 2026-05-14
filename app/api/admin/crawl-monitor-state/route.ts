import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "reports", "crawl_monitor_state.json");
    const raw = await readFile(filePath, "utf-8");
    const state = JSON.parse(raw);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "monitor state not found",
      },
      { status: 404 }
    );
  }
}
