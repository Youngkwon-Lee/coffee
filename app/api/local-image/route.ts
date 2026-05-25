import { promises as fs } from "node:fs";
import { basename, extname, normalize, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PREFIXES = [
  "/Users/youngkwon/Downloads/",
  "/tmp/",
];

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Development only route" }, { status: 403 });
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const normalizedPath = normalize(resolve(path));
  const isAllowed = ALLOWED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  const extension = extname(normalizedPath).toLowerCase();
  const mimeType = MIME_BY_EXT[extension];
  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  try {
    const file = await fs.readFile(normalizedPath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${basename(normalizedPath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
