/**
 * Engine 2 logic inventory: decision flow in the order gates fire.
 * 1. Compute alignment_score → 2. Alignment state → 3. Evaluate stack →
 * 4. Evaluate alignment for HIGH → 5. Assign confidence → 6. Bias → 7. Divergence/warnings
 * Source: interpretation-engine.ts and docs.
 */

export interface DecisionStep {
  id: string;
  stepNumber: number;
  title: string;
  /** Order gates fire: condition → outcome (if/else ladder). */
  ladder: { condition: string; outcome: string }[];
  /** What diagnostics should display for this step. */
  display: string[];
}

/** Decision flow: order matches engine evaluation. */
export const ENGINE2_DECISION_FLOW: DecisionStep[] = [
  {
    id: "step-1-alignment",
    stepNumber: 1,
    title: "Alignment state",
    ladder: [
      { condition: "alignment_score >= 0.75", outcome: "→ STRONG" },
      { condition: "Else if alignment_score >= 0.55", outcome: "→ MODERATE" },
      { condition: "Else if alignment_score >= 0.35", outcome: "→ WEAK" },
      { condition: "Else", outcome: "→ DISALIGNED" },
    ],
    display: [
      "% of bars reaching each branch",
      "Which branch dominates",
      "Is top branch (STRONG) ever reached?",
    ],
  },
  {
    id: "step-2-confidence",
    stepNumber: 2,
    title: "Confidence ladder",
    ladder: [
      { condition: "stack >= 0.70 AND alignment_score >= 0.65", outcome: "→ HIGH" },
      { condition: "Else if stack >= 0.40", outcome: "→ MEDIUM" },
      { condition: "Else", outcome: "→ LOW" },
    ],
    display: [
      "% of bars satisfying each condition",
      "% failing at each gate",
      "Which condition blocks most often",
    ],
  },
  {
    id: "step-3-bias",
    stepNumber: 3,
    title: "Bias logic",
    ladder: [
      {
        condition: "wave3_prob >= 0.6 AND wave_number == 3 AND momentum >= 0.55",
        outcome: "→ CONTINUATION",
      },
      {
        condition: "wave5_exh >= 0.6 AND wave_number == 5 AND divergence_risk >= 0.5",
        outcome: "→ EXHAUSTION",
      },
      { condition: "Else", outcome: "→ NEUTRAL" },
    ],
    display: [
      "% reaching each path",
      "Which condition is most restrictive",
      "Whether gates cluster by timeframe",
    ],
  },
];

/** Prerequisite: alignment_score is computed first (upstream). */
export const ALIGNMENT_SCORE_PREREQUISITE = {
  title: "Prerequisite — alignment_score (computed first)",
  formula:
    "alignment_score = w1·momentum + w2·stack + w3·volatility + w4·divergence + w5·wave_context",
  weights: [
    { name: "momentum_strength_score", value: "0.30" },
    { name: "multi_tf_stack_score", value: "0.30" },
    { name: "volatility_regime_score", value: "0.15" },
    { name: "divergence_score", value: "0.15" },
    { name: "wave_context_weight", value: "0.10" },
  ],
};

/** After the ladder: stack rail, key factors, warnings (order 3 → 6 → 7). */
export const AFTER_LADDER = {
  stackRail: "stack >= 0.60 → stack_aligned (rail / key factor)",
  divergenceWarnings:
    "Evaluate divergence for warnings: divergence_score <= 0.40, STRONG+LOW, Wave 5 + vol < 0.40",
};

/** Wave number enum (context input). */
export const WAVE_NUMBER_VALUES = ["3", "4", "5", "NONE"] as const;
