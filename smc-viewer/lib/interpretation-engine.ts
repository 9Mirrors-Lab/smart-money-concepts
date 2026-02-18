/**
 * Engine 2 interpretive layer. Consumes alignment scores + wave context;
 * returns a Market Interpretation Object. Read-only; no UI, no Engine 2 changes.
 */

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
}

const KEY_FACTORS_ALIGNED = "Multi-timeframe stack aligned";
const KEY_FACTORS_MISALIGNED = "Higher timeframe misalignment";
const STACK_THRESHOLD_ALIGNED = 0.6;

function alignmentState(alignmentScore: number): AlignmentState {
  if (alignmentScore >= 0.75) return "STRONG";
  if (alignmentScore >= 0.55) return "MODERATE";
  if (alignmentScore >= 0.35) return "WEAK";
  return "DISALIGNED";
}

function dominantBias(
  wave3Prob: number | null,
  wave5ExhProb: number | null,
  waveNumber: "3" | "4" | "5" | "NONE" | null,
  momentumStrength: number | null,
  divergenceScore: number | null
): DominantBias {
  const divRisk = divergenceScore != null ? 1 - divergenceScore : 1;
  if (
    (wave3Prob ?? 0) >= 0.6 &&
    waveNumber === "3" &&
    (momentumStrength ?? 0) >= 0.55
  ) {
    return "CONTINUATION";
  }
  if (
    (wave5ExhProb ?? 0) >= 0.6 &&
    waveNumber === "5" &&
    divRisk >= 0.5
  ) {
    return "EXHAUSTION";
  }
  return "NEUTRAL";
}

function confidenceLevel(
  multiTfStack: number | null,
  alignmentScore: number | null
): ConfidenceLevel {
  if (
    (multiTfStack ?? 0) >= 0.7 &&
    (alignmentScore ?? 0) >= 0.65
  ) {
    return "HIGH";
  }
  if ((multiTfStack ?? 0) >= 0.4) return "MEDIUM";
  return "LOW";
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
  confidence: ConfidenceLevel
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

  if ((wave3Prob ?? 0) >= 0.6 && waveNum === "3") {
    candidates.push({ label: "Wave 3 impulse confirmed", score: wave3Prob ?? 0 });
  }
  if ((wave5ExhProb ?? 0) >= 0.6 && waveNum === "5") {
    candidates.push({ label: "Wave 5 extension detected", score: wave5ExhProb ?? 0 });
  }
  if ((stack ?? 0) >= STACK_THRESHOLD_ALIGNED) {
    candidates.push({ label: KEY_FACTORS_ALIGNED, score: stack ?? 0 });
  }
  const stackVal = stack ?? 0;
  if (stackVal < STACK_THRESHOLD_ALIGNED && 1 - stackVal >= 0.6) {
    candidates.push({ label: KEY_FACTORS_MISALIGNED, score: 1 - stackVal });
  }
  if ((momentum ?? 0) >= 0.6) {
    candidates.push({ label: "Momentum expanding", score: momentum ?? 0 });
  }
  if ((vol ?? 0) >= 0.6) {
    candidates.push({ label: "Volatility contracting", score: vol ?? 0 });
  }
  if (divRisk >= 0.6) {
    candidates.push({ label: "Divergence forming", score: divRisk });
  }

  const filtered = candidates.filter((c) => c.score >= 0.6);
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
  confidence: ConfidenceLevel
): string[] {
  const waveNum = normalizeWaveNumber(input.wave_number);
  const divHealth = toNum(input.divergence_score);
  const vol = toNum(input.volatility_regime_score);
  const out: string[] = [];

  if ((divHealth ?? 1) <= 0.4) {
    out.push("Divergence increasing against price highs");
  }
  if (alignment === "STRONG" && confidence === "LOW") {
    out.push("Lower timeframe strength lacks higher timeframe confirmation");
  }
  if (waveNum === "5" && (vol ?? 1) < 0.4) {
    out.push("Volatility contraction during Wave 5");
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
 */
export function interpret(input: ScoresAndWaveInput): MarketInterpretation {
  const alignmentScore = toNum(input.alignment_score) ?? 0;
  const alignment = alignmentState(alignmentScore);
  const waveNum = normalizeWaveNumber(input.wave_number);
  const bias = dominantBias(
    toNum(input.wave3_probability),
    toNum(input.wave5_exhaustion_probability),
    waveNum,
    toNum(input.momentum_strength_score),
    toNum(input.divergence_score)
  );
  const confidence = confidenceLevel(
    toNum(input.multi_tf_stack_score),
    toNum(input.alignment_score)
  );

  const narrative_summary = buildNarrative(alignment, bias, waveNum);
  const key_factors = buildKeyFactors(input, alignment, bias, confidence);
  const warnings = buildWarnings(input, alignment, confidence);
  const stack_aligned = (toNum(input.multi_tf_stack_score) ?? 0) >= STACK_THRESHOLD_ALIGNED;

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
export function getBarBreakdown(input: ScoresAndWaveInput): BarBreakdown {
  const alignmentScore = toNum(input.alignment_score) ?? 0;
  const alignment = alignmentState(alignmentScore);
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
    divHealth
  );
  const confidence = confidenceLevel(stack, alignmentScore);

  const rawScores: BarBreakdownRawScores = {
    alignment_score: toNum(input.alignment_score),
    wave3_probability: wave3Prob,
    wave5_exhaustion_probability: wave5ExhProb,
    momentum_strength_score: momentum,
    multi_tf_stack_score: stack,
    volatility_regime_score: vol,
    divergence_score: divHealth,
    wave_number: waveNum,
  };

  const rulesFired: string[] = [];
  if (alignmentScore >= 0.75) rulesFired.push("alignment_score ≥ 0.75 → STRONG");
  else if (alignmentScore >= 0.55) rulesFired.push("alignment_score ≥ 0.55 → MODERATE");
  else if (alignmentScore >= 0.35) rulesFired.push("alignment_score ≥ 0.35 → WEAK");
  else rulesFired.push("alignment_score < 0.35 → DISALIGNED");

  if ((stack ?? 0) >= 0.7 && (alignmentScore ?? 0) >= 0.65)
    rulesFired.push("multi_tf_stack ≥ 0.7 and alignment_score ≥ 0.65 → HIGH confidence");
  else if ((stack ?? 0) >= 0.4) rulesFired.push("multi_tf_stack_score ≥ 0.4 → MEDIUM confidence");
  else rulesFired.push("multi_tf_stack_score < 0.4 → LOW confidence");

  if ((stack ?? 0) >= STACK_THRESHOLD_ALIGNED)
    rulesFired.push(`multi_tf_stack_score ≥ ${STACK_THRESHOLD_ALIGNED} → stack_aligned`);

  if (
    (wave3Prob ?? 0) >= 0.6 &&
    waveNum === "3" &&
    (momentum ?? 0) >= 0.55
  )
    rulesFired.push("wave3_prob ≥ 0.6, wave_number=3, momentum ≥ 0.55 → CONTINUATION");
  else if (
    (wave5ExhProb ?? 0) >= 0.6 &&
    waveNum === "5" &&
    divRisk >= 0.5
  )
    rulesFired.push("wave5_exhaustion ≥ 0.6, wave_number=5, div_risk ≥ 0.5 → EXHAUSTION");
  else rulesFired.push("CONTINUATION/EXHAUSTION conditions not met → NEUTRAL");

  const rulesBlocked: string[] = [];
  if (alignment !== "STRONG") {
    if (alignmentScore < 0.75)
      rulesBlocked.push("STRONG alignment blocked by alignment_score < 0.75");
  }
  if (confidence !== "HIGH") {
    if ((stack ?? 0) < 0.7)
      rulesBlocked.push("HIGH confidence blocked by multi_tf_stack_score < 0.7");
    if ((alignmentScore ?? 0) < 0.65)
      rulesBlocked.push("HIGH confidence blocked by alignment_score < 0.65");
  }
  if (confidence === "LOW") {
    if ((stack ?? 0) < 0.4)
      rulesBlocked.push("MEDIUM confidence blocked by multi_tf_stack_score < 0.4");
  }
  if (bias !== "CONTINUATION") {
    if ((wave3Prob ?? 0) < 0.6)
      rulesBlocked.push("CONTINUATION blocked by wave3_probability < 0.6");
    if (waveNum !== "3")
      rulesBlocked.push("CONTINUATION blocked by wave_number ≠ 3");
    if ((momentum ?? 0) < 0.55)
      rulesBlocked.push("CONTINUATION blocked by momentum_strength_score < 0.55");
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
