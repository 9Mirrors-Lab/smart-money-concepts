/**
 * Types for Engine 2 diagnostic checklist and scorecard.
 * Checklist responses are persisted (e.g. localStorage) and consumed by the scorecard view.
 */

export const ENGINE2_CHECKLIST_STORAGE_KEY = "engine2-checklist-responses";

/** Storage for the most recent "Run all timeframes" result; used by "Load first analysis". */
export const ENGINE2_FIRST_ANALYSIS_LATEST_KEY = "engine2-first-analysis-latest";

/** Storage for raw loaded analysis results (per-TF diagnostics); used by "Update checklist" on Evaluate. */
export const ENGINE2_LOADED_ANALYSIS_RESULTS_KEY = "engine2-loaded-analysis-results";

export interface LoadedAnalysisResults {
  symbol: string;
  /** Per-timeframe diagnostics; shape matches DiagnosticsApiResult. */
  results: Record<string, unknown>;
  diagnosticMarkdown?: string;
  lastUpdated: string;
}

export function saveLoadedAnalysisResults(payload: Omit<LoadedAnalysisResults, "lastUpdated">): void {
  if (typeof window === "undefined") return;
  try {
    const full: LoadedAnalysisResults = {
      ...payload,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(ENGINE2_LOADED_ANALYSIS_RESULTS_KEY, JSON.stringify(full));
  } catch {
    /* ignore */
  }
}

export function getLoadedAnalysisResults(): LoadedAnalysisResults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENGINE2_LOADED_ANALYSIS_RESULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoadedAnalysisResults;
    return parsed?.symbol && parsed?.results && typeof parsed.results === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Write checklist state to storage and notify listeners (e.g. Evaluate panel). */
export function writeChecklistStateAndNotify(state: Engine2ChecklistState): void {
  if (typeof window === "undefined") return;
  try {
    const toSave = { ...state, lastUpdated: new Date().toISOString() };
    localStorage.setItem(ENGINE2_CHECKLIST_STORAGE_KEY, JSON.stringify(toSave));
    window.dispatchEvent(new CustomEvent("engine2-checklist-updated"));
  } catch {
    /* ignore */
  }
}

export interface FirstAnalysisLatest {
  diagnosticMarkdown: string;
  symbol: string;
  lastUpdated: string;
}

export function saveLatestFirstAnalysis(markdown: string, symbol: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload: FirstAnalysisLatest = {
      diagnosticMarkdown: markdown,
      symbol,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(ENGINE2_FIRST_ANALYSIS_LATEST_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function getLatestFirstAnalysis(): FirstAnalysisLatest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENGINE2_FIRST_ANALYSIS_LATEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirstAnalysisLatest;
    return parsed?.diagnosticMarkdown && parsed?.symbol ? parsed : null;
  } catch {
    return null;
  }
}

/** Section 1: Alignment State Coverage */
export interface AlignmentCoverageResponses {
  strongAppears5To10: boolean;
  strongZeroEverywhere: boolean;
  weakOver60FourTfs: boolean;
  disalignedClustering: "higher-tfs-only" | "everywhere" | "unsure";
  decision: "leave-as-is" | "flag-relaxation" | "flag-tf-override";
}

/** Section 2: Confidence State Saturation */
export interface ConfidenceSaturationResponses {
  lowConfidenceOver90All: boolean;
  mediumHighBothZero: boolean;
  sameRuleBlocksEverywhere: boolean;
  decision: "intentionally-conservative" | "needs-gradation" | "medium-before-high";
}

/** Section 3: Dominant Bias Distribution */
export interface BiasDistributionResponses {
  neutralOver70Most: boolean;
  continuationClustersTfs: boolean;
  exhaustionLess1NonZero: boolean;
  exhaustionAlwaysZero: boolean;
  decision: "matches-intent" | "continuation-too-rare" | "exhaustion-unreachable";
}

/** Section 4: Gating Dominance */
export interface GatingDominanceResponses {
  oneRuleBlocks95All: boolean;
  sameBlockerHtfLtf: boolean;
  multipleRulesRedundant: boolean;
  decision: "intentional" | "masks-other-logic" | "needs-sensitivity-testing";
}

/** Section 5: Timeframe Role Validation */
export interface TimeframeRoleResponses {
  htfsConfirmatory: boolean;
  midTfsShowContinuation: boolean;
  ltfsVarianceLessConfidence: boolean;
  decision: "roles-align" | "one-tf-incorrect";
}

/** Section 6: Rare vs Unreachable Audit */
export interface RareVsUnreachableResponses {
  stateEverAppears: boolean;
  stateRareUnder5: boolean;
  stateBlockedDesignOrAccident: "design" | "accident" | "unsure" | null;
  decision: "keep-rare" | "remove-dead" | "adjust-thresholds";
}

/** Section 7: Readiness Before Tuning */
export interface ReadinessResponses {
  gridPopulatedAllTfs: boolean;
  fiveHundredBarsPerTf: boolean;
  dominantBlockersIdentified: boolean;
  desiredRolePerTfDocumented: boolean;
}

/** Final output fields (filled after checklist) */
export interface ChecklistFinalOutput {
  candidateThresholdsToTest: string[];
  deadOrUnreachableStates: string[];
  confirmedTfRoleMap: string;
  designIntentNotes: string;
  marketBehaviorNotes: string;
  logicArtifactNotes: string;
}

export interface Engine2ChecklistState {
  diagnosticMarkdown: string;
  section1Alignment: Partial<AlignmentCoverageResponses>;
  section2Confidence: Partial<ConfidenceSaturationResponses>;
  section3Bias: Partial<BiasDistributionResponses>;
  section4Gating: Partial<GatingDominanceResponses>;
  section5TimeframeRole: Partial<TimeframeRoleResponses>;
  section6RareUnreachable: Partial<RareVsUnreachableResponses>;
  section7Readiness: Partial<ReadinessResponses>;
  finalOutput: Partial<ChecklistFinalOutput>;
  lastUpdated: string;
}

export const defaultChecklistState: Engine2ChecklistState = {
  diagnosticMarkdown: "",
  section1Alignment: {},
  section2Confidence: {},
  section3Bias: {},
  section4Gating: {},
  section5TimeframeRole: {},
  section6RareUnreachable: {},
  section7Readiness: {},
  finalOutput: {},
  lastUpdated: new Date().toISOString(),
};
