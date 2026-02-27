/**
 * Engine 2 interpretive layer. Consumes alignment scores + wave context;
 * returns a Market Interpretation Object. Read-only; no UI, no Engine 2 changes.
 * Optional overrides allow runtime tuning (e.g. from engine2-tune page).
 */

import { getConfig, type Engine2LogicConfig, type Engine2LogicOverrides } from "./engine2-logic-config";

export type AlignmentState =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "DISALIGNED";

export type DominantBias =
  | "CONTINUATION"
  | "EXHAUSTION"
  | "NEUTRAL";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface MarketInterpretation {
  alignment_state: AlignmentState;
  dominant_bias: DominantBias;
  confidence_level: ConfidenceLevel;
  narrative_summary: string;
  key_factors: string[];
  warnings: string[];
  /** True when multi_tf_stack_score ≥ 0.6 (aligned). Used for alignment rail in multi-TF view. */
  stack_aligned: boolean;
}

/** Numeric value from DB (may be number or string). */
function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Wave number from API: 3, 4, 5, or NONE. */
function normalizeWaveNumber(
  wn: unknown
): "3" | "4" | "5" | "NONE" | null {
  if (wn == null) return null;
  const s = String(wn).trim().toUpperCase();
  if (s === "3" || s === "4" || s === "5") return s as "3" | "4" | "5";
  if (s === "NONE" || s === "") return "NONE";
  return null;
}

export interface ScoresAndWaveInput {
  alignment_score: unknown;
  wave3_probability: unknown;
  wave5_exhaustion_probability: unknown;
  momentum_strength_score: unknown;
  multi_tf_stack_score: unknown;
  volatility_regime_score: unknown;
  /** Health: higher = less divergence risk. */
  divergence_score: unknown;
  wave_number?: unknown;
  trend_direction?: unknown;
  wave_phase?: unknown;
  wave_start_time?: unknown;
  wave_peak_time?: unknown;
  wave_start_price?: unknown;
  wave_peak_price?: unknown;
  wave_travel_path?: unknown;
  internal_iv_low?: unknown;
  internal_iv_high?: unknown;
  prior_wave1_slope?: unknown;
}

const KEY_FACTORS_ALIGNED = "Multi-timeframe stack aligned";
const KEY_FACTORS_MISALIGNED = "Higher timeframe misalignment";

function alignmentState(alignmentScore: number, c: Engine2LogicConfig): AlignmentState {
  if (alignmentScore >= c.alignment_strong) return "STRONG";
  if (alignmentScore >= c.alignment_moderate) return "MODERATE";
  if (alignmentScore >= c.alignment_weak) return "WEAK";
  return "DISALIGNED";
}

function dominantBias(
  wave3Prob: number | null,
  wave5ExhProb: number | null,
  waveNumber: "3" | "4" | "5" | "NONE" | null,
  momentumStrength: number | null,
  divergenceScore: number | null,
  c: Engine2LogicConfig
): DominantBias {
  const divRisk = divergenceScore != null ? 1 - divergenceScore : 1;
  if (
    (wave3Prob ?? 0) >= c.bias_cont_wave3 &&
    waveNumber === "3" &&
    (momentumStrength ?? 0) >= c.bias_cont_momentum
  ) {
    return "CONTINUATION";
  }
  if (
    (wave5ExhProb ?? 0) >= c.bias_exh_wave5 &&
    waveNumber === "5" &&
    divRisk >= c.bias_exh_div_risk
  ) {
    return "EXHAUSTION";
  }
  return "NEUTRAL";
}

function confidenceLevel(
  multiTfStack: number | null,
  alignmentScore: number | null,
  waveNumber: "3" | "4" | "5" | "NONE" | null,
  waveStartPrice: number | null,
  waveStartTime: string | null,
  wavePeakPrice: number | null,
  wavePeakTime: string | null,
  priorWave1Slope: number | null,
  c: Engine2LogicConfig
): { confidence: ConfidenceLevel; rulesFired: string[]; rulesBlocked: string[] } {
  const rulesFired: string[] = [];
  const rulesBlocked: string[] = [];
  
  // Module C: Box Proportionality (Slope alignment)
  // If evaluating Wave 3, check if slope is >= prior Wave 1 slope. If not, restrict HIGH.
  let isSlopeRestricted = false;
  if (waveNumber === "3" && waveStartPrice != null && waveStartTime != null && wavePeakPrice != null && wavePeakTime != null && priorWave1Slope != null) {
      // Inline simple slope calculation to avoid importing box-math into UI client code
      const startMs = new Date(waveStartTime).getTime();
      const endMs = new Date(wavePeakTime).getTime();
      const duration = endMs - startMs;
      if (duration > 60000) { // 1 min min
          const slopeW3 = (wavePeakPrice - waveStartPrice) / duration;
          if (slopeW3 < priorWave1Slope) {
              isSlopeRestricted = true;
          }
      }
  }

  if (
    (multiTfStack ?? 0) >= c.conf_high_stack &&
    (alignmentScore ?? 0) >= c.conf_high_align &&
    !isSlopeRestricted
  ) {
    rulesFired.push(`multi_tf_stack ≥ ${c.conf_high_stack} and alignment_score ≥ ${c.conf_high_align} → HIGH confidence`);
    return { confidence: "HIGH", rulesFired, rulesBlocked };
  }
  
  if ((multiTfStack ?? 0) >= c.conf_high_stack && (alignmentScore ?? 0) >= c.conf_high_align && isSlopeRestricted) {
    rulesBlocked.push(`HIGH confidence blocked by Module C: Wave 3 velocity (slope) < prior Wave 1 velocity`);
  } else {
    if ((multiTfStack ?? 0) < c.conf_high_stack) rulesBlocked.push(`HIGH confidence blocked by multi_tf_stack_score < ${c.conf_high_stack}`);
    if ((alignmentScore ?? 0) < c.conf_high_align) rulesBlocked.push(`HIGH confidence blocked by alignment_score < ${c.conf_high_align}`);
  }

  if ((multiTfStack ?? 0) >= c.conf_medium_stack) {
    rulesFired.push(`multi_tf_stack_score ≥ ${c.conf_medium_stack} → MEDIUM confidence`);
    return { confidence: "MEDIUM", rulesFired, rulesBlocked };
  }
  
  rulesBlocked.push(`MEDIUM confidence blocked by multi_tf_stack_score < ${c.conf_medium_stack}`);
  rulesFired.push(`multi_tf_stack_score < ${c.conf_medium_stack} → LOW confidence`);
  return { confidence: "LOW", rulesFired, rulesBlocked };
}

const ALLOWED_FACTORS = [
  "Wave 3 impulse confirmed",
  "Wave 5 extension detected",
  KEY_FACTORS_ALIGNED,
  "Momentum expanding",
  "Volatility contracting",
  "Divergence forming",
  KEY_FACTORS_MISALIGNED,
] as const;

function buildKeyFactors(
  input: ScoresAndWaveInput,
  alignment: AlignmentState,
  bias: DominantBias,
  confidence: ConfidenceLevel,
  c: Engine2LogicConfig
): string[] {
  const waveNum = normalizeWaveNumber(input.wave_number);
  const wave3Prob = toNum(input.wave3_probability);
  const wave5ExhProb = toNum(input.wave5_exhaustion_probability);
  const momentum = toNum(input.momentum_strength_score);
  const stack = toNum(input.multi_tf_stack_score);
  const vol = toNum(input.volatility_regime_score);
  const divHealth = toNum(input.divergence_score);
  const divRisk = divHealth != null ? 1 - divHealth : 0;

  const candidates: { label: (typeof ALLOWED_FACTORS)[number]; score: number }[] = [];

  if ((wave3Prob ?? 0) >= c.bias_cont_wave3 && waveNum === "3") {
    candidates.push({ label: "Wave 3 impulse confirmed", score: wave3Prob ?? 0 });
  }
  if ((wave5ExhProb ?? 0) >= c.bias_exh_wave5 && waveNum === "5") {
    candidates.push({ label: "Wave 5 extension detected", score: wave5ExhProb ?? 0 });
  }
  if ((stack ?? 0) >= c.stack_aligned) {
    candidates.push({ label: KEY_FACTORS_ALIGNED, score: stack ?? 0 });
  }
  const stackVal = stack ?? 0;
  if (stackVal < c.stack_aligned && 1 - stackVal >= c.key_factor_misalign) {
    candidates.push({ label: KEY_FACTORS_MISALIGNED, score: 1 - stackVal });
  }
  if ((momentum ?? 0) >= c.key_factor_momentum) {
    candidates.push({ label: "Momentum expanding", score: momentum ?? 0 });
  }
  if ((vol ?? 0) >= c.key_factor_vol) {
    candidates.push({ label: "Volatility contracting", score: vol ?? 0 });
  }
  if (divRisk >= c.key_factor_div_risk) {
    candidates.push({ label: "Divergence forming", score: divRisk });
  }

  const filtered = candidates.filter((x) => x.score >= c.key_factor_relevance);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of filtered) {
    if (seen.has(c.label)) continue;
    if (c.label === KEY_FACTORS_ALIGNED && seen.has(KEY_FACTORS_MISALIGNED)) continue;
    if (c.label === KEY_FACTORS_MISALIGNED && seen.has(KEY_FACTORS_ALIGNED)) continue;
    seen.add(c.label);
    out.push(c.label);
  }
  return out.slice(0, 4);
}

function buildWarnings(
  input: ScoresAndWaveInput,
  alignment: AlignmentState,
  confidence: ConfidenceLevel,
  c: Engine2LogicConfig
): string[] {
  const waveNum = normalizeWaveNumber(input.wave_number);
  const divHealth = toNum(input.divergence_score);
  const vol = toNum(input.volatility_regime_score);
  const netTravel = toNum(input.wave_start_price) != null && toNum(input.wave_peak_price) != null 
      ? Math.abs(toNum(input.wave_peak_price)! - toNum(input.wave_start_price)!) 
      : null;
  const totalPath = toNum(input.wave_travel_path);

  const out: string[] = [];

  if ((divHealth ?? 1) <= c.warn_divergence_max) {
    out.push("Divergence increasing against price highs");
  }
  if (alignment === "STRONG" && confidence === "LOW") {
    out.push("Lower timeframe strength lacks higher timeframe confirmation");
  }
  if (waveNum === "5" && (vol ?? 1) < c.warn_vol_wave5_min) {
    out.push("Volatility contraction during Wave 5");
  }

  // Module B: Negative Space warning for Corrective Waves
  if (waveNum === "4" && netTravel != null && totalPath != null && totalPath > 0) {
      const efficiency = netTravel / totalPath;
      if (efficiency > 0.50) {
          out.push("Wave 4 exhibits high structural efficiency; lack of expected negative space warns of potential failure");
      }
  }

  return out;
}

function buildNarrative(
  alignment: AlignmentState,
  bias: DominantBias,
  waveNum: "3" | "4" | "5" | "NONE" | null
): string {
  if (bias === "CONTINUATION" && alignment === "STRONG") {
    return "Multi-timeframe structure is aligned in Wave 3 with expanding momentum and volatility.";
  }
  if (bias === "CONTINUATION" && alignment === "MODERATE") {
    return "Wave 3 structure with moderate alignment and momentum support.";
  }
  if (bias === "EXHAUSTION" && alignment === "MODERATE") {
    return "Wave 5 structure with rising divergence suggests increasing exhaustion risk despite trend continuation.";
  }
  if (bias === "EXHAUSTION" && alignment === "STRONG") {
    return "Wave 5 extension with strong alignment; divergence and volatility warrant caution.";
  }
  if (alignment === "WEAK" || alignment === "DISALIGNED") {
    return "Market structure is mixed with limited timeframe agreement and muted momentum.";
  }
  if (bias === "NEUTRAL") {
    return "Market structure is mixed with limited timeframe agreement and muted momentum.";
  }
  return "Conditions are mixed; alignment and bias are inconclusive.";
}

/**
 * Derive a Market Interpretation from one row of scores + wave context.
 * Does not modify Engine 2 data; read-only.
 * Optional overrides (e.g. from tune page) replace default thresholds.
 */
export function interpret(input: ScoresAndWaveInput, overrides?: Engine2LogicOverrides | null): MarketInterpretation {
  const c = getConfig(overrides ?? undefined);
  const alignmentScore = toNum(input.alignment_score) ?? 0;
  const alignment = alignmentState(alignmentScore, c);
  const waveNum = normalizeWaveNumber(input.wave_number);
  const bias = dominantBias(
    toNum(input.wave3_probability),
    toNum(input.wave5_exhaustion_probability),
    waveNum,
    toNum(input.momentum_strength_score),
    toNum(input.divergence_score),
    c
  );
  const { confidence } = confidenceLevel(
    toNum(input.multi_tf_stack_score),
    toNum(input.alignment_score),
    waveNum,
    toNum(input.wave_start_price),
    typeof input.wave_start_time === 'string' ? input.wave_start_time : null,
    toNum(input.wave_peak_price),
    typeof input.wave_peak_time === 'string' ? input.wave_peak_time : null,
    toNum(input.prior_wave1_slope),
    c
  );

  const narrative_summary = buildNarrative(alignment, bias, waveNum);
  const key_factors = buildKeyFactors(input, alignment, bias, confidence, c);
  const warnings = buildWarnings(input, alignment, confidence, c);
  const stack_aligned = (toNum(input.multi_tf_stack_score) ?? 0) >= c.stack_aligned;

  return {
    alignment_state: alignment,
    dominant_bias: bias,
    confidence_level: confidence,
    narrative_summary,
    key_factors,
    warnings,
    stack_aligned,
  };
}

/** Raw numeric scores for diagnostics (same keys as ScoresAndWaveInput where numeric). */
export interface BarBreakdownRawScores {
  alignment_score: number | null;
  wave3_probability: number | null;
  wave5_exhaustion_probability: number | null;
  momentum_strength_score: number | null;
  multi_tf_stack_score: number | null;
  volatility_regime_score: number | null;
  divergence_score: number | null;
  wave_number: "3" | "4" | "5" | "NONE" | null;
  wave_start_time: string | null;
  wave_peak_time: string | null;
  wave_start_price: number | null;
  wave_peak_price: number | null;
  wave_travel_path: number | null;
  internal_iv_low: number | null;
  internal_iv_high: number | null;
  prior_wave1_slope: number | null;
}

export interface BarBreakdown {
  rawScores: BarBreakdownRawScores;
  derived: {
    alignment_state: AlignmentState;
    dominant_bias: DominantBias;
    confidence_level: ConfidenceLevel;
  };
  rulesFired: string[];
  rulesBlocked: string[];
}

/**
 * Same as interpret() but also returns raw scores and which rules fired / blocked.
 * Used by diagnostics panel and API.
 */
export function getBarBreakdown(input: ScoresAndWaveInput, overrides?: Engine2LogicOverrides | null): BarBreakdown {
  const c = getConfig(overrides ?? undefined);
  const alignmentScore = toNum(input.alignment_score) ?? 0;
  const alignment = alignmentState(alignmentScore, c);
  const waveNum = normalizeWaveNumber(input.wave_number);
  const wave3Prob = toNum(input.wave3_probability);
  const wave5ExhProb = toNum(input.wave5_exhaustion_probability);
  const momentum = toNum(input.momentum_strength_score);
  const stack = toNum(input.multi_tf_stack_score);
  const vol = toNum(input.volatility_regime_score);
  const divHealth = toNum(input.divergence_score);
  const divRisk = divHealth != null ? 1 - divHealth : 1;

  const bias = dominantBias(
    wave3Prob,
    wave5ExhProb,
    waveNum,
    momentum,
    divHealth,
    c
  );
  const { confidence, rulesFired: confRulesFired, rulesBlocked: confRulesBlocked } = confidenceLevel(
    stack, 
    alignmentScore, 
    waveNum,
    toNum(input.wave_start_price),
    typeof input.wave_start_time === 'string' ? input.wave_start_time : null,
    toNum(input.wave_peak_price),
    typeof input.wave_peak_time === 'string' ? input.wave_peak_time : null,
    toNum(input.prior_wave1_slope),
    c
  );

  const rawScores: BarBreakdownRawScores = {
    alignment_score: toNum(input.alignment_score),
    wave3_probability: wave3Prob,
    wave5_exhaustion_probability: wave5ExhProb,
    momentum_strength_score: momentum,
    multi_tf_stack_score: stack,
    volatility_regime_score: vol,
    divergence_score: divHealth,
    wave_number: waveNum,
    wave_start_time: typeof input.wave_start_time === 'string' ? input.wave_start_time : null,
    wave_peak_time: typeof input.wave_peak_time === 'string' ? input.wave_peak_time : null,
    wave_start_price: toNum(input.wave_start_price),
    wave_peak_price: toNum(input.wave_peak_price),
    wave_travel_path: toNum(input.wave_travel_path),
    internal_iv_low: toNum(input.internal_iv_low),
    internal_iv_high: toNum(input.internal_iv_high),
    prior_wave1_slope: toNum(input.prior_wave1_slope),
  };

  const rulesFired: string[] = [];
  if (alignmentScore >= c.alignment_strong) rulesFired.push(`alignment_score ≥ ${c.alignment_strong} → STRONG`);
  else if (alignmentScore >= c.alignment_moderate) rulesFired.push(`alignment_score ≥ ${c.alignment_moderate} → MODERATE`);
  else if (alignmentScore >= c.alignment_weak) rulesFired.push(`alignment_score ≥ ${c.alignment_weak} → WEAK`);
  else rulesFired.push(`alignment_score < ${c.alignment_weak} → DISALIGNED`);

  rulesFired.push(...confRulesFired);
  if ((stack ?? 0) >= c.stack_aligned)
    rulesFired.push(`multi_tf_stack_score ≥ ${c.stack_aligned} → stack_aligned`);

  if (
    (wave3Prob ?? 0) >= c.bias_cont_wave3 &&
    waveNum === "3" &&
    (momentum ?? 0) >= c.bias_cont_momentum
  )
    rulesFired.push(`wave3_prob ≥ ${c.bias_cont_wave3}, wave_number=3, momentum ≥ ${c.bias_cont_momentum} → CONTINUATION`);
  else if (
    (wave5ExhProb ?? 0) >= c.bias_exh_wave5 &&
    waveNum === "5" &&
    divRisk >= c.bias_exh_div_risk
  )
    rulesFired.push(`wave5_exhaustion ≥ ${c.bias_exh_wave5}, wave_number=5, div_risk ≥ ${c.bias_exh_div_risk} → EXHAUSTION`);
  else rulesFired.push("CONTINUATION/EXHAUSTION conditions not met → NEUTRAL");

  const rulesBlocked: string[] = [];
  if (alignment !== "STRONG") {
    if (alignmentScore < c.alignment_strong)
      rulesBlocked.push(`STRONG alignment blocked by alignment_score < ${c.alignment_strong}`);
  }
  
  rulesBlocked.push(...confRulesBlocked);

  if (bias !== "CONTINUATION") {
    if ((wave3Prob ?? 0) < c.bias_cont_wave3)
      rulesBlocked.push(`CONTINUATION blocked by wave3_probability < ${c.bias_cont_wave3}`);
    if (waveNum !== "3")
      rulesBlocked.push("CONTINUATION blocked by wave_number ≠ 3");
    if ((momentum ?? 0) < c.bias_cont_momentum)
      rulesBlocked.push(`CONTINUATION blocked by momentum_strength_score < ${c.bias_cont_momentum}`);
  }

  return {
    rawScores,
    derived: {
      alignment_state: alignment,
      dominant_bias: bias,
      confidence_level: confidence,
    },
    rulesFired,
    rulesBlocked,
  };
}

/**
 * Compute global bias banner from multiple interpretations (multi-TF).
 * Do not average scores; use counts and states only.
 */
export function computeGlobalBiasBanner(
  interpretations: MarketInterpretation[]
): string | undefined {
  const strongCount = interpretations.filter(
    (i) => i.alignment_state === "STRONG"
  ).length;
  const continuationCount = interpretations.filter(
    (i) => i.dominant_bias === "CONTINUATION"
  ).length;
  const exhaustionCount = interpretations.filter(
    (i) => i.dominant_bias === "EXHAUSTION"
  ).length;

  if (strongCount >= 1 && continuationCount >= 2) {
    return "Market in expansion phase";
  }
  if (exhaustionCount >= 2) {
    return "Late-stage / risk-aware conditions";
  }
  return undefined;
}
