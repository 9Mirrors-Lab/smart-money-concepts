/**
 * Derive Engine 2 checklist state from loaded per-TF diagnostics.
 * Used by the Evaluate page "Update checklist" action.
 */

import type { DiagnosticsApiResult } from "@/components/diagnostics-panel";
import { TIMEFRAME_ORDER } from "@/lib/engine2-diagnostic-flow-data";
import {
  defaultChecklistState,
  getLoadedAnalysisResults,
  type Engine2ChecklistState,
  type LoadedAnalysisResults,
} from "@/lib/engine2-checklist-types";

const HTFS = ["1M", "1W"];
const MID_TFS = ["1D", "360"];
const LTFS = ["90", "23"];

function pct(rec: Record<string, { count: number; pct: number }>, key: string): number {
  return rec[key]?.pct ?? 0;
}

function getDominant(
  rec: Record<string, { count: number; pct: number }>,
  order: string[]
): string {
  let best = order[0];
  let bestPct = rec[best]?.pct ?? 0;
  for (const k of order) {
    const v = rec[k]?.pct ?? 0;
    if (v > bestPct) {
      bestPct = v;
      best = k;
    }
  }
  return best;
}

function getStrongBlockPct(d: DiagnosticsApiResult): number {
  return d.gatingAnalysis.strongAlignment[0]?.pct ?? 0;
}

function getHighMedBlockPcts(d: DiagnosticsApiResult): { high: number; med: number } {
  const entries = d.gatingAnalysis.highConfidence.filter((x) => x.label.includes("multi_tf_stack"));
  const withNum = entries.map((x) => ({ ...x, num: parseFloat(x.label.replace(/^.*<\s*/, "")) || 0 }));
  withNum.sort((a, b) => b.num - a.num);
  return {
    high: withNum[0]?.pct ?? 0,
    med: withNum[1]?.pct ?? withNum[0]?.pct ?? 0,
  };
}

/** Build checklist state from loaded analysis results. */
export function checklistFromLoadedAnalysis(loaded: LoadedAnalysisResults): Engine2ChecklistState {
  const results = loaded.results as Record<string, DiagnosticsApiResult>;
  const tfs = TIMEFRAME_ORDER.filter((tf) => results[tf] && "distribution" in results[tf]);
  const get = (tf: string): DiagnosticsApiResult | null => results[tf] ?? null;

  if (tfs.length === 0) {
    return { ...defaultChecklistState, diagnosticMarkdown: loaded.diagnosticMarkdown ?? "", lastUpdated: new Date().toISOString() };
  }

  const strongPcts = tfs.map((tf) => pct(get(tf)!.distribution.alignment_state, "STRONG"));
  const weakPcts = tfs.map((tf) => pct(get(tf)!.distribution.alignment_state, "WEAK"));
  const disalignedPcts = tfs.map((tf) => pct(get(tf)!.distribution.alignment_state, "DISALIGNED"));
  const lowConfPcts = tfs.map((tf) => pct(get(tf)!.distribution.confidence_level, "LOW"));
  const mediumPcts = tfs.map((tf) => pct(get(tf)!.distribution.confidence_level, "MEDIUM"));
  const highPcts = tfs.map((tf) => pct(get(tf)!.distribution.confidence_level, "HIGH"));
  const neutralPcts = tfs.map((tf) => pct(get(tf)!.distribution.dominant_bias, "NEUTRAL"));
  const contPcts = tfs.map((tf) => pct(get(tf)!.distribution.dominant_bias, "CONTINUATION"));
  const exhPcts = tfs.map((tf) => pct(get(tf)!.distribution.dominant_bias, "EXHAUSTION"));

  const strongAppears5To10 = strongPcts.some((p) => p >= 5);
  const strongZeroEverywhere = tfs.length > 0 && strongPcts.every((p) => p === 0);
  const weakOver60FourTfs = weakPcts.filter((p) => p > 60).length >= 4;
  const disalignedSpread = disalignedPcts.some((p) => p >= 10) && disalignedPcts.some((p, i) => TIMEFRAME_ORDER.indexOf(tfs[i]) >= 4 && p >= 8);
  const disalignedClustering = disalignedSpread ? "everywhere" : weakPcts.some((p) => p > 50) ? "everywhere" : "higher-tfs-only";

  const lowConfidenceOver90All = tfs.length > 0 && lowConfPcts.every((p) => p >= 90);
  const mediumHighBothZero = tfs.length > 0 && mediumPcts.every((p) => p === 0) && highPcts.every((p) => p === 0);
  let sameRuleBlocksEverywhere = false;
  if (tfs.length >= 2) {
    const first = get(tfs[0])!;
    const strongBlock = getStrongBlockPct(first);
    const { high, med } = getHighMedBlockPcts(first);
    sameRuleBlocksEverywhere = tfs.every((tf) => {
      const d = get(tf)!;
      return getStrongBlockPct(d) >= 95 && getHighMedBlockPcts(d).high >= 90 && getHighMedBlockPcts(d).med >= 90;
    });
  }

  const neutralOver70Most = neutralPcts.filter((p) => p > 70).length >= Math.min(4, tfs.length);
  const continuationClustersTfs = contPcts.some((p) => p >= 15) && contPcts.filter((p) => p >= 10).length >= 2;
  const exhaustionLess1NonZero = exhPcts.some((p) => p > 0 && p < 1);
  const exhaustionAlwaysZero = tfs.length > 0 && exhPcts.every((p) => p === 0);

  let oneRuleBlocks95All = false;
  let sameBlockerHtfLtf = false;
  let multipleRulesRedundant = false;
  if (tfs.length >= 2) {
    const strongBlocks = tfs.map((tf) => getStrongBlockPct(get(tf)!));
    oneRuleBlocks95All = strongBlocks.every((p) => p >= 95);
    const htfStrong = HTFS.filter((tf) => results[tf]).map((tf) => getStrongBlockPct(get(tf)!));
    const ltfStrong = LTFS.filter((tf) => results[tf]).map((tf) => getStrongBlockPct(get(tf)!));
    sameBlockerHtfLtf = htfStrong.length > 0 && ltfStrong.length > 0 && Math.min(...htfStrong) >= 90 && Math.min(...ltfStrong) >= 90;
    const medBlocks = tfs.map((tf) => getHighMedBlockPcts(get(tf)!).med);
    multipleRulesRedundant = medBlocks.every((p) => p >= 95);
  }

  const htfsConfirmatory = HTFS.every((tf) => {
    const d = get(tf);
    if (!d) return true;
    const low = pct(d.distribution.confidence_level, "LOW");
    const neutral = pct(d.distribution.dominant_bias, "NEUTRAL");
    return low >= 70 || neutral >= 60;
  });
  const midTfsShowContinuation = MID_TFS.some((tf) => {
    const d = get(tf);
    return d && pct(d.distribution.dominant_bias, "CONTINUATION") >= 10;
  });
  const ltfsVarianceLessConfidence = LTFS.some((tf) => {
    const d = get(tf);
    return d && pct(d.distribution.confidence_level, "HIGH") < 5;
  });

  const stateEverAppears = strongPcts.some((p) => p > 0) || highPcts.some((p) => p > 0) || mediumPcts.some((p) => p > 0) || exhPcts.some((p) => p > 0);
  const stateRareUnder5 = strongPcts.filter((p) => p > 0).every((p) => p < 5) && highPcts.filter((p) => p > 0).every((p) => p < 5);

  const gridPopulatedAllTfs = tfs.length === TIMEFRAME_ORDER.length;
  const getBars = (tf: string) => {
    const d = get(tf);
    if (!d) return 0;
    return Math.max(0, ...Object.values(d.distribution.alignment_state).map((x) => x.count)) || 0;
  };
  const fiveHundredBarsPerTf = tfs.every((tf) => getBars(tf) >= 500);
  const dominantBlockersIdentified = tfs.every((tf) => get(tf)!.gatingAnalysis.strongAlignment.length > 0);

  const roleParts = tfs.map((tf) => {
    const d = get(tf)!;
    const align = getDominant(d.distribution.alignment_state, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]);
    const conf = getDominant(d.distribution.confidence_level, ["HIGH", "MEDIUM", "LOW"]);
    const low = pct(d.distribution.confidence_level, "LOW");
    const neutral = pct(d.distribution.dominant_bias, "NEUTRAL");
    const role = low >= 80 && neutral >= 60 ? "Confirmatory" : conf !== "LOW" ? "Expressive" : "Transitional";
    return `${tf} ${role}`;
  });
  const confirmedTfRoleMap = roleParts.join("; ");
  const marketBehaviorNotes = [
    weakPcts.some((p) => p > 50) && `WEAK dominant on ${tfs.filter((_, i) => weakPcts[i] > 50).length} TF(s)`,
    neutralPcts.some((p) => p > 70) && `NEUTRAL >70% on most TFs`,
    contPcts.some((p) => p >= 10) && `CONTINUATION clusters on ${tfs.filter((_, i) => contPcts[i] >= 10).length} TF(s)`,
    exhPcts.some((p) => p > 0) && `EXHAUSTION rare but non-zero`,
  ]
    .filter(Boolean)
    .join(". ");
  const logicArtifactNotes = oneRuleBlocks95All
    ? "Single rule (alignment/stack) blocks ≥95% across TFs; structural dominance."
    : "Multiple gating rules; review per-TF blocker breakdown.";
  const deadOrUnreachableStates: string[] = [];
  tfs.forEach((tf) => {
    const d = get(tf)!;
    d.rareStates.unreachable?.forEach((u) => deadOrUnreachableStates.push(`${tf}: ${u.state}.${u.value}`));
  });
  const candidateThresholdsToTest = [
    strongZeroEverywhere && "Relax alignment_score for STRONG (e.g. ≥ 0.70 with momentum_strength ≥ 0.6)",
    sameRuleBlocksEverywhere && "Introduce TF-specific confidence bands or stack thresholds",
  ].filter(Boolean) as string[];

  return {
    ...defaultChecklistState,
    diagnosticMarkdown: loaded.diagnosticMarkdown ?? "",
    section1Alignment: {
      strongAppears5To10,
      strongZeroEverywhere,
      weakOver60FourTfs,
      disalignedClustering,
      decision: strongZeroEverywhere ? "flag-relaxation" : weakOver60FourTfs ? "leave-as-is" : "leave-as-is",
    },
    section2Confidence: {
      lowConfidenceOver90All,
      mediumHighBothZero,
      sameRuleBlocksEverywhere,
      decision: sameRuleBlocksEverywhere ? "needs-gradation" : "intentionally-conservative",
    },
    section3Bias: {
      neutralOver70Most,
      continuationClustersTfs,
      exhaustionLess1NonZero,
      exhaustionAlwaysZero,
      decision: exhaustionAlwaysZero ? "exhaustion-unreachable" : "matches-intent",
    },
    section4Gating: {
      oneRuleBlocks95All,
      sameBlockerHtfLtf,
      multipleRulesRedundant,
      decision: oneRuleBlocks95All ? "intentional" : "needs-sensitivity-testing",
    },
    section5TimeframeRole: {
      htfsConfirmatory,
      midTfsShowContinuation,
      ltfsVarianceLessConfidence,
      decision: "roles-align",
    },
    section6RareUnreachable: {
      stateEverAppears,
      stateRareUnder5,
      stateBlockedDesignOrAccident: "design",
      decision: "adjust-thresholds",
    },
    section7Readiness: {
      gridPopulatedAllTfs,
      fiveHundredBarsPerTf,
      dominantBlockersIdentified,
      desiredRolePerTfDocumented: true,
    },
    finalOutput: {
      candidateThresholdsToTest: candidateThresholdsToTest.length ? candidateThresholdsToTest : ["Review alignment and confidence gates per TF."],
      deadOrUnreachableStates: deadOrUnreachableStates.length ? deadOrUnreachableStates : ["None identified from loaded analysis."],
      confirmedTfRoleMap,
      designIntentNotes: "Derived from loaded diagnostics; confirm against intended TF roles.",
      marketBehaviorNotes: marketBehaviorNotes || "See diagnostic markdown for distribution details.",
      logicArtifactNotes,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function getChecklistStateFromStoredAnalysis(): Engine2ChecklistState | null {
  const loaded = getLoadedAnalysisResults();
  if (!loaded) return null;
  return checklistFromLoadedAnalysis(loaded);
}
