import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PADDLE_OCR_API_URL = process.env.PADDLE_OCR_API_URL;
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "paddle_ocr.py");

function resolvePythonBin() {
  const candidates = [
    process.env.PADDLE_OCR_PYTHON_BIN,
    path.join(process.cwd(), ".venv-paddle", "bin", "python"),
    path.join(process.cwd(), ".venv", "bin", "python"),
    "python3",
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => candidate === "python3" || existsSync(candidate)) || "python3";
}

type PaddleOcrResponse = {
  code?: string;
  confidence?: number;
  details?: string;
  error?: string;
  lang?: string;
  lines?: Array<{
    box?: unknown;
    confidence?: number;
    text?: string;
  }>;
  source?: string;
  status?: string;
  text?: string;
};

function runPython(args: string[], timeoutMs = 120000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolvePythonBin(), [SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("PaddleOCR Python process timed out"));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function proxyToExternalService(formData: FormData) {
  if (!PADDLE_OCR_API_URL) {
    throw new Error("PADDLE_OCR_API_URL is not configured");
  }

  const response = await fetch(PADDLE_OCR_API_URL, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120000),
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: text,
  };
}

function parseJsonSafely(raw: string): PaddleOcrResponse {
  try {
    return JSON.parse(raw) as PaddleOcrResponse;
  } catch {
    return {
      error: "Invalid PaddleOCR response",
      details: raw,
    };
  }
}

async function runLocalScript(file: File, lang: string) {
  const extension = file.name.split(".").pop() || "jpg";
  const tempPath = path.join(os.tmpdir(), `coffee-paddle-${Date.now()}.${extension}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);
    const result = await runPython(["--image", tempPath, "--lang", lang]);
    return result;
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const lang = (formData.get("lang") as string) || "korean";

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (PADDLE_OCR_API_URL) {
      const proxied = await proxyToExternalService(formData);
      const parsed = parseJsonSafely(proxied.body);
      return NextResponse.json(parsed, { status: proxied.status });
    }

    const result = await runLocalScript(file, lang);
    const parsed = parseJsonSafely(result.stdout || result.stderr);

    if (result.code !== 0) {
      return NextResponse.json(
        {
          error: parsed.error || "PaddleOCR failed",
          details: parsed.details || result.stderr || result.stdout,
          code: parsed.code || "PADDLE_OCR_FAILED",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error: "PaddleOCR request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (PADDLE_OCR_API_URL) {
      const response = await fetch(PADDLE_OCR_API_URL, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      const raw = await response.text();
      const parsed = parseJsonSafely(raw);
      return NextResponse.json(
        {
          ...parsed,
          mode: "remote",
          configuredUrl: PADDLE_OCR_API_URL,
        },
        { status: response.ok ? 200 : 503 }
      );
    }

    const result = await runPython(["--health"], 10000);
    const parsed = parseJsonSafely(result.stdout || result.stderr);

    return NextResponse.json(
        {
          ...parsed,
          mode: "local-python",
          pythonBin: resolvePythonBin(),
        },
      { status: result.code === 0 ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        mode: "local-python",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
