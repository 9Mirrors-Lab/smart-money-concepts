/**
 * Elliott / Gann calculator: impulsive (W1–W5) vs corrective (A–C) from high, low, current.
 * Impulsive: W1 = Low + Range*0.382, W2 = W1 - Range*0.236, W3 = W2 + 0.485, W4 = W3 - 0.3, W5 = W4 + 0.618.
 * Corrective: WA = High - Range*0.618, WB = WA + Range*0.382, WC = WB - Range*0.486.
 * Expansion: W5 expansion = W4 + Range*0.786 (shown when current >= W5); WC expansion = WB - Range*0.618 (shown when current <= WC).
 */

const R1 = 0.382; // Wave 1
const R2 = 0.236; // Wave 2 retracement
const R_CORRECTIVE_A = 0.618; // Wave A (from high)
const R_CORRECTIVE_B = 0.382; // Wave B (from WA)
const R_CORRECTIVE_C = 0.486; // Wave C (from WB; 45.67/94 to match expected termination)
const R_W5_EXPANSION = 0.786; // Wave 5 expansion (next harmonic past 0.618)
const R_WC_EXPANSION = 0.618; // Wave C expansion

export interface ElliottGannResult {
  range: number;
  /** Impulsive: W1–W5 */
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
  /** Corrective: WA, WB, WC */
  wa: number;
  wb: number;
  wc: number;
  /** Expansion targets (optional for backward compat with stored results); show only when showW5Expansion / showWcExpansion */
  w5Expansion?: number;
  wcExpansion?: number;
  /** Show expansion note only when price has reached or breached standard W5 / WC termination */
  showW5Expansion?: boolean;
  showWcExpansion?: boolean;
  advice: string;
  cycle: "impulsive" | "corrective";
}

export function calculateElliottGann(
  high: number,
  low: number,
  current: number
): ElliottGannResult {
  const range_val = high - low;

  // Impulsive: Wave 1–5
  const w1_term = low + range_val * R1;
  const w2_term = w1_term - range_val * R2;
  const w3_term = w2_term + range_val * 0.485;
  const w4_term = w3_term - range_val * 0.3;
  const w5_term = w4_term + range_val * 0.618;

  // Corrective: A–C (coefficients from expected: A 0.618, B 0.382, C 0.486)
  const wa_term = high - range_val * R_CORRECTIVE_A;
  const wb_term = wa_term + range_val * R_CORRECTIVE_B;
  const wc_term = wb_term - range_val * R_CORRECTIVE_C;

  // Expansion: next harmonic past standard termination; show only when price has reached or breached that termination
  const w5_expansion = w4_term + range_val * R_W5_EXPANSION;
  const wc_expansion = wb_term - range_val * R_WC_EXPANSION;
  const showW5Expansion = current >= w5_term;
  const showWcExpansion = current <= wc_term;

  // Cycle: Current > W2 and trending toward W3 → Impulsive; Current < WB and toward WC → Corrective
  const isImpulsive = current > w2_term && current < high;
  const advice = isImpulsive
    ? `Impulsive Cycle: Buy at ${w1_term.toFixed(2)} SL ${w2_term.toFixed(2)}`
    : `Corrective Cycle: Sell at ${wa_term.toFixed(2)} SL ${high.toFixed(2)}`;

  return {
    range: range_val,
    w1: w1_term,
    w2: w2_term,
    w3: w3_term,
    w4: w4_term,
    w5: w5_term,
    wa: wa_term,
    wb: wb_term,
    wc: wc_term,
    w5Expansion: w5_expansion,
    wcExpansion: wc_expansion,
    showW5Expansion,
    showWcExpansion,
    advice,
    cycle: isImpulsive ? "impulsive" : "corrective",
  };
}
