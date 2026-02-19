"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BarBreakdown,
  MarketInterpretation,
} from "@/lib/interpretation-engine";
import { getActiveOverridesQueryFragment } from "@/lib/engine2-version-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

export interface DiagnosticsPanelProps {
  symbol: string;
  timeframe: string;
  currentTimestamp: string | null;
  interpretation: MarketInterpretation | null;
}

export interface DiagnosticsApiResult {
  distribution: {
    alignment_state: Record<string, { count: number; pct: number }>;
    confidence_level: Record<string, { count: number; pct: number }>;
    dominant_bias: Record<string, { count: number; pct: number }>;
    divergence_warning_count: number;
    wave3_continuation_count: number;
    wave5_exhaustion_count: number;
  };
  multiTfStackBands: Record<string, { count: number; pct: number }>;
  gatingAnalysis: {
    strongAlignment: { label: string; count: number; pct: number }[];
    highConfidence: { label: string; count: number; pct: number }[];
    continuationBias: { label: string; count: number; pct: number }[];
  };
  rareStates: {
    rare: { state: string; value: string; pct: number }[];
    unreachable: { state: string; value: string }[];
    overrepresented: { state: string; value: string; pct: number }[];
  };
}

function formatScore(v: number | null): string {
  if (v == null) return "—";
  return String(Math.round(v * 1000) / 1000);
}

function getTotalBars(d: DiagnosticsApiResult["distribution"]): number {
  const counts = Object.values(d.alignment_state).map((x) => x.count);
  return Math.max(0, ...counts) || 0;
}

/** Return dominant key by highest pct; fallback to first. */
function getDominant(
  rec: Record<string, { count: number; pct: number }>,
  order: string[]
): string {
  let best = order[0];
  let bestPct = rec[best]?.pct ?? 0;
  for (const k of order) {
    const p = rec[k]?.pct ?? 0;
    if (p > bestPct) {
      bestPct = p;
      best = k;
    }
  }
  return best;
}

/** Meaning label for a state based on key, pct, and whether it's unreachable (0%). */
function getMeaningLabel(
  key: string,
  pct: number,
  isUnreachable: boolean
): string {
  if (isUnreachable || pct === 0) return "Unreachable under current rules";
  if (key === "DISALIGNED") return "Structural conflict";
  if (key === "MODERATE" && pct < 20) return "Transitional, short-lived";
  if (pct >= 80) return "Default operating state";
  if (pct >= 50) return "Dominant";
  if (pct >= 10) return "Transitional, short-lived";
  if (pct >= 5) return "Occasional";
  return "Rare but reachable";
}

function getTag(pct: number, isUnreachable: boolean): "Unreachable" | "Overrepresented" | "Rare" | "Expected" {
  if (isUnreachable || pct === 0) return "Unreachable";
  if (pct > 80) return "Overrepresented";
  if (pct < 5) return "Rare";
  return "Expected";
}

/** Build executive summary sentence and pill values. */
function buildSummary(d: DiagnosticsApiResult, timeframe: string) {
  const align = getDominant(d.distribution.alignment_state, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]);
  const conf = getDominant(d.distribution.confidence_level, ["HIGH", "MEDIUM", "LOW"]);
  const bias = getDominant(d.distribution.dominant_bias, ["CONTINUATION", "EXHAUSTION", "NEUTRAL"]);
  const strongPct = d.distribution.alignment_state.STRONG?.pct ?? 0;
  const highPct = d.distribution.confidence_level.HIGH?.pct ?? 0;
  const lines: string[] = [];
  lines.push(`This timeframe is predominantly ${align} with ${conf} confidence.`);
  if (strongPct === 0) lines.push("STRONG alignment does not occur under current rules.");
  if (highPct === 0) lines.push("HIGH confidence does not occur under current rules.");
  const neutralPct = d.distribution.dominant_bias.NEUTRAL?.pct ?? 0;
  if (neutralPct >= 80) lines.push("CONTINUATION and EXHAUSTION are rare; NEUTRAL dominates.");
  else if (bias !== "NEUTRAL") lines.push(`${bias} appears; NEUTRAL is ${(100 - neutralPct).toFixed(1)}%.`);
  return { align, conf, bias, lines };
}

/** Suggested interpretation (neutral takeaway). */
function getSuggestedInterpretation(d: DiagnosticsApiResult, timeframe: string): string {
  const align = d.distribution.alignment_state;
  const conf = d.distribution.confidence_level;
  const bias = d.distribution.dominant_bias;
  const weakPct = align.WEAK?.pct ?? 0;
  const lowPct = conf.LOW?.pct ?? 0;
  const strongPct = align.STRONG?.pct ?? 0;
  const highPct = conf.HIGH?.pct ?? 0;
  const neutralPct = bias.NEUTRAL?.pct ?? 0;
  const stackLow = Object.entries(d.multiTfStackBands).find(([k]) => k.startsWith("<"))?.[1]?.pct ?? 0;

  if (weakPct >= 70 && lowPct >= 90)
    return `${timeframe} is operating as a confirmatory timeframe, not a signal generator.`;
  if (strongPct === 0 && highPct === 0 && stackLow >= 90)
    return "Stronger states require higher-TF participation under current logic.";
  if (weakPct >= 50 || lowPct >= 50)
    return "Expect WEAK/LOW as baseline; deviations are meaningful.";
  if (neutralPct >= 85)
    return "Engine 2 currently behaves as a filter, not a bias selector, on this timeframe.";
  return "Distribution suggests mixed conditions; review gating to see what blocks stronger states.";
}

/** Sort alignment/confidence/bias for display (dominant first, then by pct desc). */
function sortedEntries(rec: Record<string, { count: number; pct: number }>, order: string[]) {
  return order
    .map((k) => ({ key: k, ...rec[k] }))
    .filter((x) => x.count != null)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
}

/** Build plain-text copy of diagnostics for clipboard. */
function buildCopyText(
  symbol: string,
  timeframe: string,
  n: number,
  summary: ReturnType<typeof buildSummary>,
  d: DiagnosticsApiResult,
  suggested: string,
  breakdown: BarBreakdown | null
): string {
  const lines: string[] = [];
  lines.push(`Engine 2 Diagnostics — ${symbol} · ${timeframe}`);
  lines.push(`Based on ${n} bars`);
  lines.push("");
  lines.push("Behavior Summary");
  lines.push("—".repeat(40));
  summary.lines.forEach((l) => lines.push(`• ${l}`));
  lines.push(`Alignment: ${summary.align} | Confidence: ${summary.conf} | Bias: ${summary.bias}`);
  lines.push("");
  lines.push("What dominates?");
  lines.push("—".repeat(40));
  ["Alignment state", "Confidence", "Dominant bias"].forEach((label, idx) => {
    const order =
      idx === 0 ? ["STRONG", "MODERATE", "WEAK", "DISALIGNED"] : idx === 1 ? ["HIGH", "MEDIUM", "LOW"] : ["CONTINUATION", "EXHAUSTION", "NEUTRAL"];
    const rec = idx === 0 ? d.distribution.alignment_state : idx === 1 ? d.distribution.confidence_level : d.distribution.dominant_bias;
    lines.push(label + ":");
    sortedEntries(rec, order).forEach(({ key, pct, count }) => {
      const meaning = getMeaningLabel(key, pct, pct === 0);
      const tag = getTag(pct, pct === 0);
      lines.push(`  ${key} (${pct}%) — ${meaning} [${tag}] n=${count}`);
    });
    lines.push("");
  });
  lines.push("Why is it blocked?");
  lines.push("—".repeat(40));
  lines.push("Why STRONG never appears:");
  d.gatingAnalysis.strongAlignment.slice(0, 5).forEach((x) => lines.push(`  • ${x.label} → blocks ${x.pct}%`));
  lines.push("Why HIGH confidence never appears:");
  d.gatingAnalysis.highConfidence.slice(0, 5).forEach((x) => lines.push(`  • ${x.label} → blocks ${x.pct}%`));
  lines.push("Why CONTINUATION is rare:");
  d.gatingAnalysis.continuationBias.slice(0, 5).forEach((x) => lines.push(`  • ${x.label} → blocks ${x.pct}%`));
  lines.push("");
  lines.push("Rare (valid but uncommon):");
  d.rareStates.rare.forEach((x) => lines.push(`  ${x.state}.${x.value} ${x.pct}%`));
  if (d.distribution.divergence_warning_count > 0)
    lines.push(`  Divergence warnings: ${d.distribution.divergence_warning_count}`);
  lines.push("Unreachable (rule-locked):");
  d.rareStates.unreachable.forEach((x) => lines.push(`  ${x.state}.${x.value}`));
  lines.push("");
  lines.push("Suggested interpretation");
  lines.push("—".repeat(40));
  lines.push(suggested);
  lines.push("(Not advice; framing only.)");
  if (breakdown) {
    lines.push("");
    lines.push("Current bar breakdown");
    lines.push("—".repeat(40));
    lines.push(`Derived: ${breakdown.derived.alignment_state} / ${breakdown.derived.dominant_bias} / ${breakdown.derived.confidence_level}`);
    lines.push("Raw scores: " + [
      `alignment ${formatScore(breakdown.rawScores.alignment_score)}`,
      `wave3 ${formatScore(breakdown.rawScores.wave3_probability)}`,
      `stack ${formatScore(breakdown.rawScores.multi_tf_stack_score)}`,
    ].join(", "));
    breakdown.rulesFired.forEach((r) => lines.push(`  Fired: ${r}`));
    breakdown.rulesBlocked.forEach((r) => lines.push(`  Blocked: ${r}`));
  }
  return lines.join("\n");
}

/** Shared diagnostics sections (Behavior Summary through Suggested interpretation). Used in single-TF and aggregate views. */
export function DiagnosticsResultSections({
  data,
  timeframe,
  showRaw = false,
  onShowRawChange,
}: {
  data: DiagnosticsApiResult;
  timeframe: string;
  showRaw?: boolean;
  onShowRawChange?: (v: boolean) => void;
}) {
  const n = getTotalBars(data.distribution);
  const summary = buildSummary(data, timeframe);
  const suggested = getSuggestedInterpretation(data, timeframe);
  return (
    <>
      <section className="rounded border border-border bg-background/50 p-3">
        <h4 className="text-xs font-medium text-foreground">
          Behavior Summary — {timeframe}
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">Based on {n} bars</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-foreground">
          {summary.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            Alignment: {summary.align}
          </span>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            Confidence: {summary.conf}
          </span>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            Bias: {summary.bias}
          </span>
        </div>
      </section>

      <section className="rounded border border-border bg-background/50 p-3">
        <h4 className="text-xs font-medium text-foreground">What dominates?</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Distribution with meaning labels (not raw counts).
        </p>
        <div className="mt-2 space-y-3 text-xs">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Alignment state</p>
            <ul className="space-y-1">
              {sortedEntries(data.distribution.alignment_state, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]).map(
                ({ key, count, pct }) => {
                  const isUnreachable = pct === 0;
                  const meaning = getMeaningLabel(key, pct, isUnreachable);
                  const tag = getTag(pct, isUnreachable);
                  return (
                    <li key={key} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-foreground">{key}</span>
                      <span className="text-muted-foreground">({pct}%) — {meaning}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          tag === "Unreachable" && "bg-red-500/15 text-red-600",
                          tag === "Overrepresented" && "bg-amber-500/15 text-amber-600",
                          tag === "Rare" && "bg-blue-500/15 text-blue-600",
                          tag === "Expected" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {tag}
                      </span>
                      {showRaw && <span className="text-muted-foreground">n={count}</span>}
                    </li>
                  );
                }
              )}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Confidence</p>
            <ul className="space-y-1">
              {sortedEntries(data.distribution.confidence_level, ["HIGH", "MEDIUM", "LOW"]).map(
                ({ key, count, pct }) => {
                  const isUnreachable = pct === 0;
                  const meaning = getMeaningLabel(key, pct, isUnreachable);
                  const tag = getTag(pct, isUnreachable);
                  return (
                    <li key={key} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-foreground">{key}</span>
                      <span className="text-muted-foreground">({pct}%) — {meaning}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          tag === "Unreachable" && "bg-red-500/15 text-red-600",
                          tag === "Overrepresented" && "bg-amber-500/15 text-amber-600",
                          tag === "Rare" && "bg-blue-500/15 text-blue-600",
                          tag === "Expected" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {tag}
                      </span>
                      {showRaw && <span className="text-muted-foreground">n={count}</span>}
                    </li>
                  );
                }
              )}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Dominant bias</p>
            <ul className="space-y-1">
              {sortedEntries(data.distribution.dominant_bias, ["CONTINUATION", "EXHAUSTION", "NEUTRAL"]).map(
                ({ key, count, pct }) => {
                  const isUnreachable = pct === 0;
                  const meaning = getMeaningLabel(key, pct, isUnreachable);
                  const tag = getTag(pct, isUnreachable);
                  return (
                    <li key={key} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-foreground">{key}</span>
                      <span className="text-muted-foreground">({pct}%) — {meaning}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          tag === "Unreachable" && "bg-red-500/15 text-red-600",
                          tag === "Overrepresented" && "bg-amber-500/15 text-amber-600",
                          tag === "Rare" && "bg-blue-500/15 text-blue-600",
                          tag === "Expected" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {tag}
                      </span>
                      {showRaw && <span className="text-muted-foreground">n={count}</span>}
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        </div>
        {onShowRawChange && (
          <button
            type="button"
            onClick={() => onShowRawChange(!showRaw)}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            {showRaw ? "Hide raw counts" : "Show raw counts"}
          </button>
        )}
      </section>

      <section className="rounded border border-border bg-background/50 p-3">
        <h4 className="text-xs font-medium text-foreground">Why is it blocked?</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Primary and secondary blockers (relax one to see what changes).
        </p>
        <div className="mt-2 space-y-4 text-xs">
          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Why STRONG never appears</p>
            {data.gatingAnalysis.strongAlignment.length === 0 ? (
              <p className="text-muted-foreground">No bars reached STRONG.</p>
            ) : (
              <ul className="space-y-1 pl-2">
                {data.gatingAnalysis.strongAlignment.slice(0, 3).map((x, i) => (
                  <li key={i} className="border-l-2 border-border pl-2">
                    <span className="text-foreground">{x.label}</span>
                    <span className="text-muted-foreground"> → blocks {x.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Why HIGH confidence never appears</p>
            {data.gatingAnalysis.highConfidence.length === 0 ? (
              <p className="text-muted-foreground">No bars reached HIGH confidence.</p>
            ) : (
              <ul className="space-y-1 pl-2">
                {data.gatingAnalysis.highConfidence.slice(0, 3).map((x, i) => (
                  <li key={i} className="border-l-2 border-border pl-2">
                    <span className="text-foreground">{x.label}</span>
                    <span className="text-muted-foreground"> → blocks {x.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Why CONTINUATION is rare</p>
            {data.gatingAnalysis.continuationBias.length === 0 ? (
              <p className="text-muted-foreground">No CONTINUATION blockers.</p>
            ) : (
              <ul className="space-y-1 pl-2">
                {data.gatingAnalysis.continuationBias.slice(0, 3).map((x, i) => (
                  <li key={i} className="border-l-2 border-border pl-2">
                    <span className="text-foreground">{x.label}</span>
                    <span className="text-muted-foreground"> → blocks {x.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-border bg-background/50 p-3">
        <h4 className="text-xs font-medium text-foreground">Dominant bias reality check</h4>
        <ul className="mt-2 space-y-1 text-xs text-foreground">
          {(() => {
            const nb = data.distribution.dominant_bias;
            const neu = nb.NEUTRAL?.pct ?? 0;
            const cont = nb.CONTINUATION?.pct ?? 0;
            const exh = nb.EXHAUSTION?.pct ?? 0;
            return (
              <>
                <li>NEUTRAL: {neu}% — {neu >= 80 ? "System defaults to neutral bias." : "Mixed with other biases."}</li>
                <li>CONTINUATION: {cont}% — {cont < 15 ? "Only appears under strict Wave 3 + momentum." : "Appears when conditions are met."}</li>
                <li>EXHAUSTION: {exh}% — {exh < 5 ? "Rare but reachable." : "Occasional."}</li>
              </>
            );
          })()}
        </ul>
        {(data.distribution.dominant_bias.NEUTRAL?.pct ?? 0) >= 80 && (
          <p className="mt-2 border-t border-border pt-2 text-xs italic text-muted-foreground">
            Engine 2 currently behaves as a filter, not a bias selector, on this timeframe.
          </p>
        )}
      </section>

      <section className="rounded border border-border bg-background/50 p-3">
        <h4 className="text-xs font-medium text-foreground">What never happens vs rare?</h4>
        <div className="mt-2 grid gap-2">
          <div className="rounded border border-border bg-muted/20 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rare (valid but uncommon)</p>
            <p className="text-[10px] text-muted-foreground">Market-dependent, acceptable</p>
            {data.rareStates.rare.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {data.rareStates.rare.map((x, i) => (
                  <li key={i}>{x.state}.{x.value} {x.pct}%</li>
                ))}
              </ul>
            )}
            {data.distribution.divergence_warning_count > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Divergence warnings: {data.distribution.divergence_warning_count}</p>
            )}
          </div>
          <div className="rounded border border-red-500/30 bg-red-500/5 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-red-600">Unreachable (rule-locked)</p>
            <p className="text-[10px] text-muted-foreground">Rule-constrained, not market-dependent</p>
            {data.rareStates.unreachable.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {data.rareStates.unreachable.map((x, i) => (
                  <li key={i}>{x.state}.{x.value}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {suggested && (
        <section className="rounded border border-border bg-background/50 p-3">
          <h4 className="text-xs font-medium text-foreground">Suggested interpretation</h4>
          <p className="mt-1 text-xs italic text-muted-foreground">{suggested}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Not advice; framing only.</p>
        </section>
      )}
    </>
  );
}

export function DiagnosticsPanel({
  symbol,
  timeframe,
  currentTimestamp,
  interpretation,
}: DiagnosticsPanelProps) {
  const [breakdown, setBreakdown] = useState<BarBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] =
    useState<DiagnosticsApiResult | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!symbol || !timeframe || !currentTimestamp) {
      setBreakdown(null);
      return;
    }
    let cancelled = false;
    setBreakdownLoading(true);
    const params = new URLSearchParams({
      symbol,
      timeframe,
      timestamp: currentTimestamp,
      diagnostics: "1",
    });
    const overridesFragment = getActiveOverridesQueryFragment();
    fetch(`/api/alignment-engine/interpretation?${params}${overridesFragment}`)
      .then((r) => r.json())
      .then((body: { breakdown?: BarBreakdown; error?: string }) => {
        if (cancelled) return;
        if (body.error && !body.breakdown) {
          setBreakdown(null);
        } else {
          setBreakdown(body.breakdown ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setBreakdown(null);
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, currentTimestamp]);

  const runAllQueries = useCallback(() => {
    if (!symbol || !timeframe) return;
    setDiagnosticsError(null);
    setDiagnosticsLoading(true);
    const params = new URLSearchParams({ symbol, timeframe, limit: "5000" });
    const overridesFragment = getActiveOverridesQueryFragment();
    fetch(`/api/alignment-engine/diagnostics?${params}${overridesFragment}`)
      .then((r) => r.json())
      .then((body: DiagnosticsApiResult | { error?: string; detail?: string }) => {
        if ("error" in body && body.error) {
          setDiagnosticsError(body.detail ?? body.error);
          setDiagnosticsResult(null);
        } else {
          setDiagnosticsResult(body as DiagnosticsApiResult);
        }
      })
      .catch((e) => {
        setDiagnosticsError(e instanceof Error ? e.message : "Failed to fetch");
        setDiagnosticsResult(null);
      })
      .finally(() => setDiagnosticsLoading(false));
  }, [symbol, timeframe]);

  const n = diagnosticsResult ? getTotalBars(diagnosticsResult.distribution) : 0;
  const summary = diagnosticsResult ? buildSummary(diagnosticsResult, timeframe) : null;
  const suggested = diagnosticsResult ? getSuggestedInterpretation(diagnosticsResult, timeframe) : null;

  const copyResults = useCallback(() => {
    if (!diagnosticsResult || !summary || n <= 0) return;
    const text = buildCopyText(symbol, timeframe, n, summary, diagnosticsResult, suggested ?? "", breakdown);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [symbol, timeframe, diagnosticsResult, summary, n, suggested, breakdown]);

  return (
    <div className="flex h-full min-w-[360px] flex-col gap-4 overflow-y-auto border-l border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Diagnostics</h3>
        <div className="flex items-center gap-2">
          {diagnosticsResult && summary && n > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={copyResults}
              title="Copy full diagnostics to clipboard"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy results"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={runAllQueries}
            disabled={!symbol || !timeframe || diagnosticsLoading}
          >
            {diagnosticsLoading ? "Running…" : "Run all queries"}
          </Button>
        </div>
      </div>
      {symbol && timeframe && (
        <p className="text-xs text-muted-foreground">
          {symbol} · {timeframe}
        </p>
      )}
      {diagnosticsError && (
        <p className="text-xs text-destructive">{diagnosticsError}</p>
      )}

      {!diagnosticsResult && !diagnosticsLoading && (
        <p className="text-xs text-muted-foreground">
          Run all queries to see behavior summary and interpretation.
        </p>
      )}

      {diagnosticsResult && summary && n > 0 && (
        <DiagnosticsResultSections
          data={diagnosticsResult}
          timeframe={timeframe}
          showRaw={showRaw}
          onShowRawChange={setShowRaw}
        />
      )}

      {/* Current bar breakdown — unchanged, question-style header */}
      <section className="rounded border border-border bg-background/50 p-2">
        <h4 className="mb-2 text-xs font-medium text-foreground">
          Why did this bar resolve this way?
        </h4>
        {!currentTimestamp && (
          <p className="text-xs text-muted-foreground">Select a bar for breakdown.</p>
        )}
        {currentTimestamp && breakdownLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {currentTimestamp && !breakdownLoading && breakdown && (
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-medium text-muted-foreground">Raw scores: </span>
              <span className="text-foreground">
                alignment {formatScore(breakdown.rawScores.alignment_score)}, wave3{" "}
                {formatScore(breakdown.rawScores.wave3_probability)}, wave5_exh{" "}
                {formatScore(breakdown.rawScores.wave5_exhaustion_probability)}, momentum{" "}
                {formatScore(breakdown.rawScores.momentum_strength_score)}, stack{" "}
                {formatScore(breakdown.rawScores.multi_tf_stack_score)}, vol{" "}
                {formatScore(breakdown.rawScores.volatility_regime_score)}, div{" "}
                {formatScore(breakdown.rawScores.divergence_score)}
              </span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Derived: </span>
              <span className="text-foreground">
                {breakdown.derived.alignment_state} / {breakdown.derived.dominant_bias} /{" "}
                {breakdown.derived.confidence_level}
              </span>
            </div>
            {breakdown.rulesFired.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Rules fired: </span>
                <ul className="list-inside list-disc pl-1">
                  {breakdown.rulesFired.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {breakdown.rulesBlocked.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Rules blocked: </span>
                <ul className="list-inside list-disc pl-1">
                  {breakdown.rulesBlocked.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {currentTimestamp && !breakdownLoading && !breakdown && interpretation && (
          <p className="text-xs text-muted-foreground">No breakdown for this bar.</p>
        )}
      </section>
    </div>
  );
}
