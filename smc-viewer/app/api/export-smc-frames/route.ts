import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * POST /api/export-smc-frames
 * Body: { symbol, timeframe?, allTimeframes?, last?, window? }
 * Runs the Python export script to update smc_results. Requires script and venv at repo root (parent of smc-viewer).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const symbol =
      (body.symbol as string)?.trim() || "KCEX_ETHUSDT.P";
    const timeframe = (body.timeframe as string)?.trim() || "23";
    const allTimeframes = Boolean(body.allTimeframes);
    const last = Math.min(
      10000,
      Math.max(100, Number(body.last) || 500)
    );
    const window = Math.min(
      500,
      Math.max(50, Number(body.window) || 100)
    );

    const cwd = process.cwd();
    const projectRoot = path.resolve(cwd, "..");
    const scriptPath = path.join(projectRoot, "scripts", "export_smc_frames.py");
    const venvPython = path.join(projectRoot, ".venv", "bin", "python");

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        {
          error: "Export script not found",
          detail: `Expected at ${scriptPath}. Run from smc-viewer with repo root as parent.`,
        },
        { status: 503 }
      );
    }

    const python = fs.existsSync(venvPython) ? venvPython : "python3";
    const args = [
      scriptPath,
      "--source",
      "supabase",
      "--symbol",
      symbol,
      "--timeframe",
      timeframe,
      "--last",
      String(last),
      "--window",
      String(window),
      "--save-to-db",
    ];
    if (allTimeframes) {
      args.push("--all-timeframes");
    }

    const env = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_MARKET_URL:
        process.env.NEXT_PUBLIC_SUPABASE_MARKET_URL || "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY || "",
    };

    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
      (resolve) => {
        const proc = spawn(python, args, {
          cwd: projectRoot,
          env,
          shell: false,
        });
        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (d) => {
          stdout += d.toString();
        });
        proc.stderr?.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          resolve({ stdout, stderr, code });
        });
        proc.on("error", (err) => {
          resolve({
            stdout,
            stderr: stderr || err.message,
            code: 1,
          });
        });
      }
    );

    if (result.code !== 0) {
      return NextResponse.json(
        {
          error: "Export failed",
          detail: result.stderr || result.stdout || `Exit code ${result.code}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: allTimeframes
        ? `Exported and saved to smc_results for 23, 90, 360, 1D, 1W, 1M (${last} bars, window ${window}).`
        : `Exported and saved to smc_results for ${symbol} ${timeframe} (${last} bars, window ${window}).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Export error", detail: message },
      { status: 500 }
    );
  }
}
