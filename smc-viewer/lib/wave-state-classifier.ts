/**
 * WaveStateClassifier
 *
 * Pure, deterministic classification of where current price sits within
 * the computed Elliott/Gann wave structure.  Takes only computed wave
 * levels and current price — no external data, no async calls.
 */

import type { ElliottGannResult } from "./elliott-gann-calculator";

// ─── Output types ────────────────────────────────────────────────────────────

export type WavePosition =
  | "Inside Wave 5"
  | "Wave 5 Extension"
  | "Inside Wave 4"
  | "Inside Wave 3"
  | "Inside Wave 2"
  | "Inside Wave 1"
  | "Impulsive Invalidated"
  | "Wave C Active"
  | "Wave C Extension"
  | "Corrective Weakening"
  | "Wave A Breakdown"
  | "Inside Wave B"
  | "Inside Wave A";

export type StructureValidity = "valid" | "invalidated";
export type ProximityFlag = "Approaching termination zone" | "Neutral";
export type ActiveCycle = "impulsive" | "corrective";

export interface WaveStateClassification {
  /** Where price sits in the wave structure */
  currentWavePosition: WavePosition;
  /** Whether the dominant cycle structure remains intact */
  structureValidity: StructureValidity;
  /** Whether price is within 15% of range from primary target */
  proximityFlag: ProximityFlag;
  /** Dominant cycle bias */
  activeCycle: ActiveCycle;
  /** Price level that invalidates the dominant cycle */
  invalidationLevel: number;
  /** First structural target for the dominant cycle */
  primaryTarget: number;
  /** Extended harmonic target beyond primary */
  extendedTarget: number;
}

// ─── Classifier ──────────────────────────────────────────────────────────────

export function classifyWaveState(
  result: ElliottGannResult,
  current: number
): WaveStateClassification {
  const { w1, w2, w3, w4, w5, wa, wb, wc, range, cycle } = result;
  const w5Exp = result.w5Expansion ?? w5;
  const wcExp = result.wcExpansion ?? wc;

  // ── Impulsive classification ──────────────────────────────────────────────
  if (cycle === "impulsive") {
    let position: WavePosition;

    if (current < w2) {
      // Price has broken below Wave 2 — structure is invalidated
      position = "Impulsive Invalidated";
    } else if (current >= w5) {
      // Price has exceeded Wave 5 termination — extension territory
      position = "Wave 5 Extension";
    } else if (current >= w4 && current < w5) {
      position = "Inside Wave 5";
    } else if (current >= w3 && current < w4) {
      position = "Inside Wave 4";
    } else if (current >= w2 && current < w3) {
      position = "Inside Wave 3";
    } else if (current >= w1 && current < w2) {
      position = "Inside Wave 2";
    } else {
      position = "Inside Wave 1";
    }

    const isInvalidated = position === "Impulsive Invalidated";
    const primaryTarget = w5;
    const extendedTarget = w5Exp;
    const invalidationLevel = w2;

    const distanceToPrimary = Math.abs(current - primaryTarget);
    const proximityFlag: ProximityFlag =
      distanceToPrimary < 0.15 * range
        ? "Approaching termination zone"
        : "Neutral";

    return {
      currentWavePosition: position,
      structureValidity: isInvalidated ? "invalidated" : "valid",
      proximityFlag,
      activeCycle: "impulsive",
      invalidationLevel,
      primaryTarget,
      extendedTarget,
    };
  }

  // ── Corrective classification ─────────────────────────────────────────────
  let position: WavePosition;

  if (current <= wc) {
    // Price at or below WC termination — extension territory
    position = "Wave C Extension";
  } else if (current <= wb) {
    // Price between WC and WB — Wave C is actively unfolding
    position = "Wave C Active";
  } else if (current > wb && current <= wa) {
    // Price has bounced above WB but is still below WA — corrective structure weakening
    position = "Corrective Weakening";
  } else if (current > wa && current < result.wc) {
    // Unusual: price above WA but below WC — treat as inside Wave A zone
    position = "Inside Wave A";
  } else if (current < wa) {
    // Price below WA — Wave A breakdown (deeper than expected)
    position = "Wave A Breakdown";
  } else {
    // Price above WA — inside Wave B territory
    position = "Inside Wave B";
  }

  const isInvalidated = position === "Wave A Breakdown";
  const primaryTarget = wc;
  const extendedTarget = wcExp;
  // Corrective invalidation: break above WB signals corrective structure is failing
  const invalidationLevel = wb;

  const distanceToPrimary = Math.abs(current - primaryTarget);
  const proximityFlag: ProximityFlag =
    distanceToPrimary < 0.15 * range
      ? "Approaching termination zone"
      : "Neutral";

  return {
    currentWavePosition: position,
    structureValidity: isInvalidated ? "invalidated" : "valid",
    proximityFlag,
    activeCycle: "corrective",
    invalidationLevel,
    primaryTarget,
    extendedTarget,
  };
}
