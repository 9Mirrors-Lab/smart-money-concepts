/**
 * ScenarioEngine
 *
 * Builds structured bullish / bearish scenario blocks from wave levels and
 * the classified wave state.  Pure function — no external data, no async.
 */

import type { ElliottGannResult } from "./elliott-gann-calculator";
import type { WaveStateClassification } from "./wave-state-classifier";

// ─── Output types ────────────────────────────────────────────────────────────

export interface Scenario {
  /** "Bullish" or "Bearish" */
  direction: "Bullish" | "Bearish";
  /** Whether this scenario is the primary (dominant) or alternate */
  isPrimary: boolean;
  /** Condition that activates this scenario */
  condition: string;
  /** Price target if condition is met */
  target: number;
  /** Formatted target label, e.g. "W5 termination" */
  targetLabel: string;
  /** Price level that invalidates this scenario */
  invalidation: number;
  /** Formatted invalidation label */
  invalidationLabel: string;
}

export interface ScenarioSet {
  primary: Scenario;
  alternate: Scenario;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function buildScenarios(
  result: ElliottGannResult,
  classification: WaveStateClassification
): ScenarioSet {
  const { w1, w2, w4, w5, wa, wb } = result;
  const w5Exp = result.w5Expansion ?? w5;
  const wcExp = result.wcExpansion ?? result.wc;
  const { activeCycle, primaryTarget, extendedTarget, invalidationLevel } = classification;

  if (activeCycle === "corrective") {
    // Primary: bearish — corrective structure drives price toward WC / extension
    const bearish: Scenario = {
      direction: "Bearish",
      isPrimary: true,
      condition: `Price holds below ${wb.toFixed(2)} (WB)`,
      target: primaryTarget,
      targetLabel: "WC termination",
      invalidation: wb,
      invalidationLabel: "WB level",
    };

    // Alternate: bullish — break above WB signals corrective structure failing
    const bullish: Scenario = {
      direction: "Bullish",
      isPrimary: false,
      condition: `Price breaks and closes above ${wb.toFixed(2)} (WB)`,
      target: wa,
      targetLabel: "WA recovery",
      invalidation: result.wc,
      invalidationLabel: "WC level",
    };

    return { primary: bearish, alternate: bullish };
  }

  // Impulsive — primary: bullish toward W5 / extension
  const bullish: Scenario = {
    direction: "Bullish",
    isPrimary: true,
    condition: `Price holds above ${w4.toFixed(2)} (W4)`,
    target: primaryTarget,
    targetLabel: "W5 termination",
    invalidation: w4,
    invalidationLabel: "W4 level",
  };

  // Alternate: bearish — break below W4 invalidates impulsive count
  const bearish: Scenario = {
    direction: "Bearish",
    isPrimary: false,
    condition: `Price breaks below ${w4.toFixed(2)} (W4)`,
    target: w2,
    targetLabel: "W2 support",
    invalidation: w1,
    invalidationLabel: "W1 level",
  };

  // If price is already in Wave 5 extension territory, adjust primary target to extended
  if (classification.currentWavePosition === "Wave 5 Extension") {
    bullish.target = extendedTarget;
    bullish.targetLabel = "W5 extension";
  }

  // If price is in Wave C extension territory, adjust corrective primary target
  if (
    classification.currentWavePosition === "Wave C Extension" &&
    activeCycle === "corrective"
  ) {
    // Already handled in corrective branch above, but guard here for safety
  }

  return { primary: bullish, alternate: bearish };
}
