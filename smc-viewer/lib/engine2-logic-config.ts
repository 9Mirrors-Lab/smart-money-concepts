/**
 * Engine 2 tunable logic: every numeric gate and its default value.
 * Used by the tune page and by interpret() when overrides are provided.
 */

export interface Engine2LogicConfig {
  /** Step 1: alignment_score thresholds (>=) */
  alignment_strong: number;
  alignment_moderate: number;
  alignment_weak: number;
  /** Step 2: confidence */
  conf_high_stack: number;
  conf_high_align: number;
  conf_medium_stack: number;
  /** Stack aligned (rail / key factor) */
  stack_aligned: number;
  /** Step 3: bias CONTINUATION */
  bias_cont_wave3: number;
  bias_cont_momentum: number;
  /** Step 3: bias EXHAUSTION */
  bias_exh_wave5: number;
  bias_exh_div_risk: number;
  /** Key factors: min relevance and thresholds */
  key_factor_relevance: number;
  key_factor_momentum: number;
  key_factor_vol: number;
  key_factor_div_risk: number;
  key_factor_misalign: number;
  /** Warnings */
  warn_divergence_max: number;
  warn_vol_wave5_min: number;
}

/** Partial overrides: only keys that are overridden. */
export type Engine2LogicOverrides = Partial<Engine2LogicConfig>;

/** Default values (match interpretation-engine.ts and docs). */
export const DEFAULT_ENGINE2_LOGIC: Engine2LogicConfig = {
  alignment_strong: 0.75,
  alignment_moderate: 0.55,
  alignment_weak: 0.35,
  conf_high_stack: 0.7,
  conf_high_align: 0.65,
  conf_medium_stack: 0.4,
  stack_aligned: 0.6,
  bias_cont_wave3: 0.6,
  bias_cont_momentum: 0.55,
  bias_exh_wave5: 0.6,
  bias_exh_div_risk: 0.5,
  key_factor_relevance: 0.6,
  key_factor_momentum: 0.6,
  key_factor_vol: 0.6,
  key_factor_div_risk: 0.6,
  key_factor_misalign: 0.6,
  warn_divergence_max: 0.4,
  warn_vol_wave5_min: 0.4,
};

/** Metadata for each key (label, category) for the tune page. */
export const ENGINE2_LOGIC_ENTRIES: {
  key: keyof Engine2LogicConfig;
  label: string;
  description: string;
  category: "alignment" | "confidence" | "bias" | "stack" | "key_factors" | "warnings";
}[] = [
  { key: "alignment_strong", label: "STRONG (≥)", description: "alignment_score ≥ → STRONG", category: "alignment" },
  { key: "alignment_moderate", label: "MODERATE (≥)", description: "alignment_score ≥ → MODERATE", category: "alignment" },
  { key: "alignment_weak", label: "WEAK (≥)", description: "alignment_score ≥ → WEAK", category: "alignment" },
  { key: "conf_high_stack", label: "HIGH stack (≥)", description: "multi_tf_stack_score ≥ → HIGH", category: "confidence" },
  { key: "conf_high_align", label: "HIGH alignment (≥)", description: "alignment_score ≥ for HIGH", category: "confidence" },
  { key: "conf_medium_stack", label: "MEDIUM stack (≥)", description: "multi_tf_stack_score ≥ → MEDIUM", category: "confidence" },
  { key: "stack_aligned", label: "Stack aligned (≥)", description: "stack_aligned rail / key factor", category: "stack" },
  { key: "bias_cont_wave3", label: "CONT wave3_prob (≥)", description: "wave3_probability ≥ for CONTINUATION", category: "bias" },
  { key: "bias_cont_momentum", label: "CONT momentum (≥)", description: "momentum_strength ≥ for CONTINUATION", category: "bias" },
  { key: "bias_exh_wave5", label: "EXH wave5 (≥)", description: "wave5_exhaustion_prob ≥ for EXHAUSTION", category: "bias" },
  { key: "bias_exh_div_risk", label: "EXH div risk (≥)", description: "divergence_risk ≥ for EXHAUSTION", category: "bias" },
  { key: "key_factor_relevance", label: "Key factor relevance (≥)", description: "Min score to include key factor", category: "key_factors" },
  { key: "key_factor_momentum", label: "Momentum expanding (≥)", description: "Key factor threshold", category: "key_factors" },
  { key: "key_factor_vol", label: "Volatility contracting (≥)", description: "Key factor threshold", category: "key_factors" },
  { key: "key_factor_div_risk", label: "Divergence forming (≥)", description: "Key factor div risk", category: "key_factors" },
  { key: "key_factor_misalign", label: "HTF misalignment (≥)", description: "1 - stack ≥ for misalign factor", category: "key_factors" },
  { key: "warn_divergence_max", label: "Divergence warning (≤)", description: "divergence_score ≤ → warning", category: "warnings" },
  { key: "warn_vol_wave5_min", label: "Wave 5 vol warning (<)", description: "volatility_regime < → Wave 5 warning", category: "warnings" },
];

export function getConfig(overrides?: Engine2LogicOverrides | null): Engine2LogicConfig {
  if (!overrides || Object.keys(overrides).length === 0) return DEFAULT_ENGINE2_LOGIC;
  return { ...DEFAULT_ENGINE2_LOGIC, ...overrides };
}
