/**
 * NarrativeBuilder
 *
 * Converts wave classification + scenario set into structured, deterministic
 * text sections.  No subjective language, no historical assumptions.
 * Pure function — input in, text out.
 */

import type { ElliottGannResult } from "./elliott-gann-calculator";
import type { WaveStateClassification } from "./wave-state-classifier";
import type { ScenarioSet } from "./scenario-engine";

// ─── Output types ────────────────────────────────────────────────────────────

export interface WaveNarrative {
  /** One-line structural state summary (badge text) */
  structuralSummary: string;
  /** Multi-sentence paragraph describing active cycle, wave position, targets */
  structuralDetail: string;
  /** Bullet strings: "If X → Y target" */
  scenarioBullets: string[];
  /** Risk context sentence; empty string when no proximity flag */
  riskContext: string;
  /** Validity badge: "valid" | "invalidated" */
  structureValidity: "valid" | "invalidated";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2);
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export function buildNarrative(
  result: ElliottGannResult,
  classification: WaveStateClassification,
  scenarios: ScenarioSet
): WaveNarrative {
  const {
    currentWavePosition,
    structureValidity,
    proximityFlag,
    activeCycle,
    invalidationLevel,
    primaryTarget,
    extendedTarget,
  } = classification;

  const cycleLabel =
    activeCycle === "impulsive" ? "Impulsive" : "Corrective";

  // ── Structural summary (badge) ────────────────────────────────────────────
  const structuralSummary =
    structureValidity === "invalidated"
      ? `${cycleLabel} structure invalidated`
      : `${cycleLabel} structure active — ${currentWavePosition}`;

  // ── Structural detail paragraph ───────────────────────────────────────────
  const lines: string[] = [];

  lines.push(`${cycleLabel} structure active.`);
  lines.push(`Price trading ${currentWavePosition.toLowerCase()}.`);

  if (structureValidity === "invalidated") {
    lines.push(
      `Structure invalidated. Price has breached the ${fmt(invalidationLevel)} invalidation level.`
    );
  } else {
    lines.push(`Primary ${activeCycle === "impulsive" ? "upside" : "downside"} target: ${fmt(primaryTarget)}.`);
    lines.push(`Extension possible to ${fmt(extendedTarget)}.`);
    lines.push(`Invalidation level: ${fmt(invalidationLevel)}.`);
  }

  const structuralDetail = lines.join(" ");

  // ── Scenario bullets ──────────────────────────────────────────────────────
  const { primary, alternate } = scenarios;

  const scenarioBullets: string[] = [
    // Primary scenario
    `${primary.condition} → ${primary.direction.toLowerCase()} continuation toward ${fmt(primary.target)} (${primary.targetLabel}).`,
    // Alternate scenario
    `${alternate.condition} → ${alternate.direction.toLowerCase()} move toward ${fmt(alternate.target)} (${alternate.targetLabel}); invalidation at ${fmt(alternate.invalidation)}.`,
  ];

  // ── Risk context ──────────────────────────────────────────────────────────
  const riskContext =
    proximityFlag === "Approaching termination zone"
      ? "Price is nearing projected termination boundary. Reversal probability increases."
      : "";

  return {
    structuralSummary,
    structuralDetail,
    scenarioBullets,
    riskContext,
    structureValidity,
  };
}

// ─── Convenience: run all three layers in one call ───────────────────────────

import { classifyWaveState } from "./wave-state-classifier";
import { buildScenarios } from "./scenario-engine";

export function interpretWaves(
  result: ElliottGannResult,
  current: number
): WaveNarrative {
  const classification = classifyWaveState(result, current);
  const scenarios = buildScenarios(result, classification);
  return buildNarrative(result, classification, scenarios);
}
