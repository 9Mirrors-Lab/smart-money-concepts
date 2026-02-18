import { NextRequest, NextResponse } from "next/server";
import {
  interpret,
  getBarBreakdown,
  computeGlobalBiasBanner,
  type MarketInterpretation,
  type ScoresAndWaveInput,
} from "@/lib/interpretation-engine";

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

function supabaseFetch(
  baseUrl: string,
  anonKey: string,
  path: string,
  params: URLSearchParams
): Promise<unknown[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${path}?${params}`;
  return fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
    },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  });
}

function mergeScoresAndWave(
  scores: Record<string, unknown>,
  wave: Record<string, unknown> | null
): ScoresAndWaveInput {
  return {
    alignment_score: scores.alignment_score,
    wave3_probability: scores.wave3_probability,
    wave5_exhaustion_probability: scores.wave5_exhaustion_probability,
    momentum_strength_score: scores.momentum_strength_score,
    multi_tf_stack_score: scores.multi_tf_stack_score,
    volatility_regime_score: scores.volatility_regime_score,
    divergence_score: scores.divergence_score,
    wave_number: wave?.wave_number ?? scores.wave_number,
    trend_direction: wave?.trend_direction,
    wave_phase: wave?.wave_phase,
  };
}

/**
 * GET /api/alignment-engine/interpretation?symbol=...&timeframe=...&timestamp=...
 * Returns single Market Interpretation for that bar.
 *
 * GET /api/alignment-engine/interpretation?symbol=...&multiTf=1
 * Returns { interpretations: MarketInterpretation[], globalBiasBanner?: string }.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const multiTf = searchParams.get("multiTf") === "1";

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol query parameter" },
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

    if (multiTf) {
      const viewParams = new URLSearchParams({
        symbol: `eq.${encodeURIComponent(symbol)}`,
        order: "timeframe.asc",
      });
      const viewRows = await supabaseFetch(
        baseUrl,
        anonKey,
        "vw_alignment_scores_latest_per_tf",
        viewParams
      );

      const interpretations: (MarketInterpretation & {
        timeframe: string;
        timestamp: string;
      })[] = [];
      for (const row of viewRows as Record<string, unknown>[]) {
        const tf = row.timeframe as string;
        const ts = row.timestamp as string;
        if (!tf || !ts) continue;
        const tsNorm = toPgTimestamp(ts);
        if (!tsNorm) continue;
        const stateParams = new URLSearchParams({
          symbol: `eq.${encodeURIComponent(symbol)}`,
          timeframe: `eq.${encodeURIComponent(tf)}`,
          timestamp: `eq.${tsNorm}`,
        });
        const stateRows = await supabaseFetch(
          baseUrl,
          anonKey,
          "wave_engine_state",
          stateParams
        );
        const waveRow =
          stateRows.length > 0
            ? (stateRows[0] as Record<string, unknown>)
            : null;
        const combined = mergeScoresAndWave(row, waveRow);
        interpretations.push({
          ...interpret(combined),
          timeframe: tf,
          timestamp: ts,
        });
      }

      const globalBiasBanner = computeGlobalBiasBanner(interpretations);

      return NextResponse.json({
        interpretations,
        globalBiasBanner: globalBiasBanner ?? undefined,
      });
    }

    const timeframe = searchParams.get("timeframe");
    const timestampRaw = searchParams.get("timestamp");
    if (!timeframe || !timestampRaw) {
      return NextResponse.json(
        { error: "Missing timeframe or timestamp (required when multiTf is not 1)" },
        { status: 400 }
      );
    }

    const timestamp = toPgTimestamp(timestampRaw);
    if (!timestamp) {
      return NextResponse.json(
        { error: "Invalid timestamp format" },
        { status: 400 }
      );
    }

    const scoreParams = new URLSearchParams({
      symbol: `eq.${encodeURIComponent(symbol)}`,
      timeframe: `eq.${encodeURIComponent(timeframe)}`,
      timestamp: `eq.${timestamp}`,
    });
    const scoreRows = await supabaseFetch(
      baseUrl,
      anonKey,
      "wave_alignment_scores",
      scoreParams
    );

    if (scoreRows.length === 0) {
      return NextResponse.json(
        { error: "No alignment score for this bar", interpretation: null },
        { status: 200 }
      );
    }

    const stateParams = new URLSearchParams({
      symbol: `eq.${encodeURIComponent(symbol)}`,
      timeframe: `eq.${encodeURIComponent(timeframe)}`,
      timestamp: `eq.${timestamp}`,
    });
    const stateRows = await supabaseFetch(
      baseUrl,
      anonKey,
      "wave_engine_state",
      stateParams
    );

    const scores = scoreRows[0] as Record<string, unknown>;
    const waveRow =
      stateRows.length > 0
        ? (stateRows[0] as Record<string, unknown>)
        : null;
    const combined = mergeScoresAndWave(scores, waveRow);
    const interpretation = interpret(combined);
    const diagnostics = searchParams.get("diagnostics") === "1";
    const payload: { interpretation: MarketInterpretation; breakdown?: ReturnType<typeof getBarBreakdown> } = { interpretation };
    if (diagnostics) {
      payload.breakdown = getBarBreakdown(combined);
    }
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "API error", detail: message },
      { status: 500 }
    );
  }
}
