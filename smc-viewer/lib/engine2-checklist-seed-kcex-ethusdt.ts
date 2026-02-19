/**
 * First Engine 2 diagnostic checklist analysis — KCEX_ETHUSDT.P · 2026-02-18
 * Filled from the comparative view grid and per-TF role breakdown.
 * Use: load this seed into the checklist (e.g. "Load first analysis" button).
 */

import type { Engine2ChecklistState } from "./engine2-checklist-types";

export const KCEX_ETHUSDT_DIAGNOSTIC_MARKDOWN = `# Engine 2 Diagnostics — Comparative View
**KCEX_ETHUSDT.P** · 2026-02-18T15:14:07Z

## Cross-Timeframe Outcome Distribution Grid

| TF | Bars | Alignment (W/M/D/S) | Confidence (L/M/H) | Bias (N/C/E) | Dominant State |
|----|------|--------------------|-------------------|--------------|----------------|
| 1M | 37 | W 48.7 · M 26.3 · D 21.1 · S 4.0 | L 94.7 · M 1.3 · H 4.0 | N 64.5 · C 34.2 · E 1.3 | WEAK / LOW |
| 1W | 231 | W 70.9 · M 20.9 · D 8.3 · S 0.0 | L 100.0 · M 0.0 · H 0.0 | N 72.7 · C 27.3 · E 0.0 | WEAK / LOW |
| 1D | 619 | W 61.9 · M 17.8 · D 8.0 · S 12.3 | L 80.8 · M 2.4 · H 16.8 | N 70.3 · C 29.7 · E 0.0 | WEAK / LOW |
| 360 | 716 | W 71.6 · M 12.8 · D 14.4 · S 1.2 | L 96.5 · M 0.9 · H 2.6 | N 85.6 · C 14.4 · E 0.0 | WEAK / LOW |
| 90 | 667 | W 66.7 · M 10.4 · D 19.4 · S 3.5 | L 95.9 · M 0.0 · H 4.1 | N 82.8 · C 16.9 · E 0.3 | WEAK / LOW |
| 23 | 776 | W 77.6 · M 9.7 · D 12.7 · S 0.0 | L 100.0 · M 0.0 · H 0.0 | N 91.4 · C 8.3 · E 0.3 | WEAK / LOW |

## Cross-Timeframe Gating & Constraint Grid

| TF | STRONG blocked | HIGH conf blocked | MED conf blocked | CONT blocked |
|----|----------------|-------------------|------------------|--------------|
| 1M | 100.0% | 98.6% | 98.6% | 70.0% |
| 1W | 100.0% | 100.0% | 100.0% | 33.8% |
| 1D | 100.0% | 97.1% | 97.1% | 35.1% |
| 360 | 100.0% | 99.1% | 99.1% | 36.2% |
| 90 | 100.0% | 100.0% | 100.0% | 42.8% |
| 23 | 100.0% | 100.0% | 100.0% | 39.8% |

## Rare / Reachable Signal Density

| TF | CONT occurrences | EXHAUST occurrences | Divergence warnings | Signal Density |
|----|------------------|---------------------|---------------------|----------------|
| 1M | 26 | 1 | 1 | Low |
| 1W | 89 | 0 | 3 | Medium |
| 1D | 297 | 0 | 35 | Medium |
| 360 | 144 | 0 | 33 | Medium |
| 90 | 169 | 3 | 34 | Medium |
| 23 | 83 | 3 | 10 | Medium |

## Cross-Timeframe Role Classification

| TF | Role | Description |
|----|------|-------------|
| 1M | Expressive | Shows early deviations; noisy |
| 1W | Confirmatory | Filters structure; not a trigger |
| 1D | Transitional | Best balance of signal + structure |
| 360 | Confirmatory | Structural validation only |
| 90 | Transitional | Execution-adjacent |
| 23 | Confirmatory | Micro-confirmation, not signal |
`;

/**
 * Filled checklist state for KCEX_ETHUSDT.P first analysis.
 * Answers use grid values; tuning only considered where pattern repeats across TFs.
 */
export const engine2ChecklistSeedKcexEthusdt: Engine2ChecklistState = {
  diagnosticMarkdown: KCEX_ETHUSDT_DIAGNOSTIC_MARKDOWN,

  section1Alignment: {
    strongAppears5To10: true,   // 1D has STRONG 12.3%
    strongZeroEverywhere: false,
    weakOver60FourTfs: true,   // WEAK >60% on 1W, 1D, 360, 90, 23 (5 TFs)
    disalignedClustering: "everywhere", // D% spread: 1M 21.1, 90 19.4, 360 14.4, 23 12.7, not only HTF
    decision: "leave-as-is",
  },

  section2Confidence: {
    lowConfidenceOver90All: false,  // 1D has LOW 80.8%
    mediumHighBothZero: false,     // 1M/1D/360/90 have MEDIUM or HIGH
    sameRuleBlocksEverywhere: true, // multi_tf_stack_score < 0.7 / < 0.4 blocks 98–100% on all TFs
    decision: "needs-gradation",
  },

  section3Bias: {
    neutralOver70Most: true,       // N >70% on 1W, 1D, 360, 90, 23 (1M is 64.5%)
    continuationClustersTfs: true, // C highest on 1M 34.2, 1W 27.3, 1D 29.7
    exhaustionLess1NonZero: true,  // E 1.3% 1M, 0.3% 90, 0.3% 23
    exhaustionAlwaysZero: false,
    decision: "matches-intent",
  },

  section4Gating: {
    oneRuleBlocks95All: true,      // alignment_score < 0.75 blocks STRONG 100% all TFs
    sameBlockerHtfLtf: true,
    multipleRulesRedundant: true,  // stack < 0.4 and < 0.7 both block ~98–100%
    decision: "intentional",
  },

  section5TimeframeRole: {
    htfsConfirmatory: true,        // 1M/1W: LOW dominant, NEUTRAL dominant
    midTfsShowContinuation: true,  // 1D 29.7% C, 360 14.4%
    ltfsVarianceLessConfidence: true, // 90/23: HIGH confidence 0% on 23, 4.1% on 90; LOW dominant
    decision: "roles-align",
  },

  section6RareUnreachable: {
    stateEverAppears: true,        // STRONG/HIGH/MEDIUM/EXH appear on at least one TF
    stateRareUnder5: true,         // STRONG, HIGH, EXH are rare where they appear
    stateBlockedDesignOrAccident: "design",
    decision: "adjust-thresholds",
  },

  section7Readiness: {
    gridPopulatedAllTfs: true,
    fiveHundredBarsPerTf: false,    // 1M 37, 1W 231 bars; rest ≥500 — noted
    dominantBlockersIdentified: true,
    desiredRolePerTfDocumented: true,
  },

  finalOutput: {
    candidateThresholdsToTest: [
      "alignment_score ≥ 0.70 for STRONG when momentum_strength ≥ 0.6 (TF-specific test first)",
      "multi_tf_stack_score ≥ 0.35 for MEDIUM when alignment ≥ 0.55",
      "TF-specific confidence bands: looser for LTF (90, 23) to allow MEDIUM before HIGH",
    ],
    deadOrUnreachableStates: [
      "STRONG on 1W, 23",
      "HIGH confidence on 1W, 23",
      "MEDIUM confidence on 1W, 90, 23",
      "EXHAUSTION on 1W, 1D, 360",
    ],
    confirmedTfRoleMap: "1M Expressive; 1W Confirmatory; 1D Transitional; 360 Confirmatory; 90 Transitional; 23 Confirmatory (micro-confirm).",
    designIntentNotes: "Conservative filter; STRONG and HIGH intentionally rare. WEAK/LOW baseline is design. Confirmatory TFs (1W, 360, 23) not meant to trigger; transitional (1D, 90) show more CONTINUATION.",
    marketBehaviorNotes: "WEAK dominant 62–78% across TFs; NEUTRAL bias 64–91%. CONTINUATION clusters on 1M/1W/1D (27–34%). EXHAUSTION rare but non-zero on 1M, 90, 23. DISALIGNED spread across TFs (8–21%).",
    logicArtifactNotes: "alignment_score < 0.75 blocks STRONG 100% on every TF (structural dominance). multi_tf_stack_score < 0.7 and < 0.4 block MEDIUM/HIGH 98–100% on all TFs; on 1W and 23 they are fully unreachable. wave3_probability < 0.6 is main CONT soft gate (18–43% block).",
  },

  lastUpdated: "2026-02-18T15:14:07Z",
};
