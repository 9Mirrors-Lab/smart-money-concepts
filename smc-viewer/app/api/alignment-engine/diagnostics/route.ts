import { NextRequest, NextResponse } from "next/server";
import { interpret, type MarketInterpretation, type ScoresAndWaveInput } from "@/lib/interpretation-engine";

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

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

interface RowInputs {
  interpretation: MarketInterpretation;
  multi_tf_stack_score: number | null;
  alignment_score: number | null;
  wave3_probability: number | null;
  wave_number: string | null;
  momentum_strength_score: number | null;
}

/** Predefined queries + gating + rare states from a list of interpreted rows. */
function runDiagnostics(rows: RowInputs[]): {
  distribution: {
    alignment_state: Record<string, { count: number; pct: number }>;
    confidence_level: Record<string, { count: number; pct: number }>;
    dominant_bias: Record<string, { count: number; pct: number }>;
    divergence_warning_count: number;
    wave3_continuation_count: number;
    wave5_exhaustion_count: number;
  };
  multiTfStackBands: Record<string, { count: number; pct: number }>;
  gatingAnalysis: {
    strongAlignment: { label: string; count: number; pct: number }[];
    highConfidence: { label: string; count: number; pct: number }[];
    continuationBias: { label: string; count: number; pct: number }[];
  };
  rareStates: {
    rare: { state: string; value: string; pct: number }[];
    unreachable: { state: string; value: string }[];
    overrepresented: { state: string; value: string; pct: number }[];
  };
} {
  const n = rows.length;
  const pct = (c: number) => (n > 0 ? Math.round((c / n) * 10000) / 100 : 0);
  const interpretations = rows.map((r) => r.interpretation);

  const alignCounts: Record<string, number> = {};
  const confCounts: Record<string, number> = {};
  const biasCounts: Record<string, number> = {};
  let divergenceWarningCount = 0;
  let wave3ContinuationCount = 0;
  let wave5ExhaustionCount = 0;

  for (const r of rows) {
    const i = r.interpretation;
    alignCounts[i.alignment_state] = (alignCounts[i.alignment_state] ?? 0) + 1;
    confCounts[i.confidence_level] = (confCounts[i.confidence_level] ?? 0) + 1;
    biasCounts[i.dominant_bias] = (biasCounts[i.dominant_bias] ?? 0) + 1;
    if (i.warnings.some((w) => w.toLowerCase().includes("divergence"))) divergenceWarningCount++;
    if (i.dominant_bias === "CONTINUATION") wave3ContinuationCount++;
    if (i.dominant_bias === "EXHAUSTION") wave5ExhaustionCount++;
  }

  const distribution = {
    alignment_state: Object.fromEntries(
      ["STRONG", "MODERATE", "WEAK", "DISALIGNED"].map((k) => [
        k,
        { count: alignCounts[k] ?? 0, pct: pct(alignCounts[k] ?? 0) },
      ])
    ) as Record<string, { count: number; pct: number }>,
    confidence_level: Object.fromEntries(
      ["HIGH", "MEDIUM", "LOW"].map((k) => [
        k,
        { count: confCounts[k] ?? 0, pct: pct(confCounts[k] ?? 0) },
      ])
    ) as Record<string, { count: number; pct: number }>,
    dominant_bias: Object.fromEntries(
      ["CONTINUATION", "EXHAUSTION", "NEUTRAL"].map((k) => [
        k,
        { count: biasCounts[k] ?? 0, pct: pct(biasCounts[k] ?? 0) },
      ])
    ) as Record<string, { count: number; pct: number }>,
    divergence_warning_count: divergenceWarningCount,
    wave3_continuation_count: wave3ContinuationCount,
    wave5_exhaustion_count: wave5ExhaustionCount,
  };

  const bandHigh = rows.filter((r) => (r.multi_tf_stack_score ?? 0) >= 0.7).length;
  const bandMid = rows.filter((r) => {
    const x = r.multi_tf_stack_score ?? 0;
    return x >= 0.4 && x < 0.7;
  }).length;
  const bandLow = rows.filter((r) => (r.multi_tf_stack_score ?? 0) < 0.4).length;
  const multiTfStackBands: Record<string, { count: number; pct: number }> = {
    ">= 0.7": { count: bandHigh, pct: pct(bandHigh) },
    "0.4-0.69": { count: bandMid, pct: pct(bandMid) },
    "< 0.4": { count: bandLow, pct: pct(bandLow) },
  };

  const strongBlockerCounts: Record<string, number> = {};
  const highBlockerCounts: Record<string, number> = {};
  const contBlockerCounts: Record<string, number> = {};
  let notStrong = 0;
  let notHigh = 0;
  let notCont = 0;

  for (const r of rows) {
    const i = r.interpretation;
    const stack = r.multi_tf_stack_score ?? null;
    const alignScore = r.alignment_score ?? null;
    if (i.alignment_state !== "STRONG") {
      notStrong++;
      strongBlockerCounts["alignment_score < 0.75"] = (strongBlockerCounts["alignment_score < 0.75"] ?? 0) + 1;
    }
    if (i.confidence_level !== "HIGH") {
      notHigh++;
      if ((stack ?? 0) < 0.7) highBlockerCounts["multi_tf_stack_score < 0.7"] = (highBlockerCounts["multi_tf_stack_score < 0.7"] ?? 0) + 1;
      if ((alignScore ?? 0) < 0.65) highBlockerCounts["alignment_score < 0.65"] = (highBlockerCounts["alignment_score < 0.65"] ?? 0) + 1;
      if (i.confidence_level === "LOW" && (stack ?? 0) < 0.4) highBlockerCounts["multi_tf_stack_score < 0.4"] = (highBlockerCounts["multi_tf_stack_score < 0.4"] ?? 0) + 1;
    }
    if (i.dominant_bias !== "CONTINUATION") {
      notCont++;
      const why: string[] = [];
      if ((r.wave3_probability ?? 0) < 0.6) why.push("wave3_probability < 0.6");
      if (r.wave_number !== "3") why.push("wave_number ≠ 3");
      if ((r.momentum_strength_score ?? 0) < 0.55) why.push("momentum_strength_score < 0.55");
      const label = why.length ? why.join(", ") : "continuation conditions not met";
      contBlockerCounts[label] = (contBlockerCounts[label] ?? 0) + 1;
    }
  }

  const toSorted = (counts: Record<string, number>, denom: number) =>
    Object.entries(counts)
      .map(([label, count]) => ({ label, count, pct: denom > 0 ? Math.round((count / denom) * 10000) / 100 : 0 }))
      .sort((a, b) => b.count - a.count);

  const gatingAnalysis = {
    strongAlignment: toSorted(strongBlockerCounts, notStrong),
    highConfidence: toSorted(highBlockerCounts, notHigh),
    continuationBias: toSorted(contBlockerCounts, notCont),
  };

  const RARE_PCT = 5;
  const OVERREP_PCT = 80;
  const rare: { state: string; value: string; pct: number }[] = [];
  const unreachable: { state: string; value: string }[] = [];
  const overrepresented: { state: string; value: string; pct: number }[] = [];

  for (const [state, values] of [
    ["alignment_state", distribution.alignment_state],
    ["confidence_level", distribution.confidence_level],
    ["dominant_bias", distribution.dominant_bias],
  ] as const) {
    for (const [value, { count, pct: p }] of Object.entries(values)) {
      if (p === 0) unreachable.push({ state, value });
      else if (p < RARE_PCT) rare.push({ state, value, pct: p });
      else if (p > OVERREP_PCT) overrepresented.push({ state, value, pct: p });
    }
  }

  return {
    distribution,
    multiTfStackBands,
    gatingAnalysis,
    rareStates: { rare, unreachable, overrepresented },
  };
}

/**
 * GET /api/alignment-engine/diagnostics?symbol=...&timeframe=...&from=...&to=...&limit=...
 * Returns predefined query results (distribution, gating, rare states) for the scope.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 10000) : 5000;

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: "Missing symbol or timeframe" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_MARKET_URL || "http://127.0.0.1:54321";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY || "";
    if (!anonKey) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY not set." },
        { status: 500 }
      );
    }

    const scoreParams = new URLSearchParams({
      symbol: `eq.${encodeURIComponent(symbol)}`,
      timeframe: `eq.${encodeURIComponent(timeframe)}`,
      order: "timestamp.asc",
      limit: String(limit),
    });
    if (from) {
      const fromPg = toPgTimestamp(from);
      if (fromPg) scoreParams.set("timestamp", `gte.${fromPg}`);
    }
    if (to) {
      const toPg = toPgTimestamp(to);
      if (toPg) scoreParams.append("timestamp", `lte.${toPg}`);
    }

    const scoreRows = (await supabaseFetch(baseUrl, anonKey, "wave_alignment_scores", scoreParams)) as Record<string, unknown>[];
    if (scoreRows.length === 0) {
      return NextResponse.json({
        distribution: {
          alignment_state: {},
          confidence_level: {},
          dominant_bias: {},
          divergence_warning_count: 0,
          wave3_continuation_count: 0,
          wave5_exhaustion_count: 0,
        },
        multiTfStackBands: {},
        gatingAnalysis: { strongAlignment: [], highConfidence: [], continuationBias: [] },
        rareStates: { rare: [], unreachable: [], overrepresented: [] },
      });
    }

    const timestamps = scoreRows.map((r) => r.timestamp as string).filter(Boolean);
    const minTs = timestamps.length ? timestamps.reduce((a, b) => (a < b ? a : b)) : null;
    const maxTs = timestamps.length ? timestamps.reduce((a, b) => (a > b ? a : b)) : null;

    let stateRows: Record<string, unknown>[] = [];
    if (minTs && maxTs) {
      const stateParams = new URLSearchParams();
      stateParams.set("symbol", `eq.${encodeURIComponent(symbol)}`);
      stateParams.set("timeframe", `eq.${encodeURIComponent(timeframe)}`);
      stateParams.set("order", "timestamp.asc");
      stateParams.set("timestamp", `gte.${minTs}`);
      stateParams.append("timestamp", `lte.${maxTs}`);
      stateRows = (await supabaseFetch(baseUrl, anonKey, "wave_engine_state", stateParams)) as Record<string, unknown>[];
    }
    const stateByTs = new Map<string, Record<string, unknown>>();
    for (const row of stateRows) {
      const ts = row.timestamp as string;
      if (ts) stateByTs.set(ts, row);
    }

    const rows: RowInputs[] = [];
    for (const scoreRow of scoreRows) {
      const ts = scoreRow.timestamp as string;
      const waveRow = ts ? stateByTs.get(ts) ?? null : null;
      const combined = mergeScoresAndWave(scoreRow, waveRow);
      const interpretation = interpret(combined);
      rows.push({
        interpretation,
        multi_tf_stack_score: toNum(scoreRow.multi_tf_stack_score),
        alignment_score: toNum(scoreRow.alignment_score),
        wave3_probability: toNum(scoreRow.wave3_probability),
        wave_number: (waveRow?.wave_number ?? scoreRow.wave_number) as string | null,
        momentum_strength_score: toNum(scoreRow.momentum_strength_score),
      });
    }

    const result = runDiagnostics(rows);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "API error", detail: message }, { status: 500 });
  }
}
