import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/smc-frames?symbol=KCEX_ETHUSDT.P&timeframe=23
 * Returns { meta, frames } from public.smc_results for the viewer.
 * Requires NEXT_PUBLIC_SUPABASE_MARKET_URL and NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY in smc-viewer/.env.local (or .env).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: "Missing symbol or timeframe query parameter" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_MARKET_URL || "http://127.0.0.1:54321";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY || "";

    if (!anonKey) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY not set. Add it to smc-viewer/.env.local (see .env.example).",
        },
        { status: 500 }
      );
    }

    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/smc_results?symbol=eq.${encodeURIComponent(symbol)}&timeframe=eq.${encodeURIComponent(timeframe)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `Supabase returned ${res.status}`,
          detail: text.slice(0, 200),
        },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No SMC results found for this symbol and timeframe" },
        { status: 404 }
      );
    }

    const row = rows[0] as { meta: unknown; frames: unknown };
    return NextResponse.json({
      meta: row.meta,
      frames: row.frames,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "API error", detail: message },
      { status: 500 }
    );
  }
}
