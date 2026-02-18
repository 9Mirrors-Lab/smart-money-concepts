import { NextRequest, NextResponse } from "next/server";

/** Normalize to ISO 8601 UTC with Z so URL encoding does not turn + into space (application/x-www-form-urlencoded). */
function toPgTimestamp(s: string | null): string | null {
  if (!s || typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:${sec}Z`;
}

/**
 * GET /api/wave-engine/state?symbol=...&timeframe=...&from=...&to=...
 * Returns wave_engine_state rows from Supabase for the chart (same approach as EWO: fetch at view time).
 * Uses NEXT_PUBLIC_SUPABASE_MARKET_URL and NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const limit = Math.min(Number(searchParams.get("limit")) || 10000, 50000);

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
            "NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY not set. Add it to smc-viewer/.env.local.",
        },
        { status: 500 }
      );
    }

    const from = toPgTimestamp(fromRaw);
    const to = toPgTimestamp(toRaw);

    const params = new URLSearchParams({
      symbol: `eq.${encodeURIComponent(symbol)}`,
      timeframe: `eq.${encodeURIComponent(timeframe)}`,
      order: "timestamp.asc",
      limit: String(limit),
    });
    if (from) params.append("timestamp", `gte.${from}`);
    if (to) params.append("timestamp", `lte.${to}`);

    const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/wave_engine_state?${params}`;
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

    const data = await res.json();
    return NextResponse.json({ data: Array.isArray(data) ? data : [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "API error", detail: message },
      { status: 500 }
    );
  }
}
