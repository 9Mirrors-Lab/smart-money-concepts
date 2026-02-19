"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Engine2Nav } from "@/components/engine2-nav";
import type { DiagnosticsApiResult } from "@/components/diagnostics-panel";
import { getConfig, ENGINE2_LOGIC_ENTRIES, type Engine2LogicConfig } from "@/lib/engine2-logic-config";
import { getActiveOverridesQueryFragment, getActiveOverrides, getVersionStore } from "@/lib/engine2-version-store";
import { ENGINE2_DECISION_FLOW } from "@/lib/engine2-logic-inventory";
import {
  TIMEFRAME_ORDER,
  PER_TF_DIAGNOSTIC,
  type TimeframeKey,
  type TimeframeDiagnostic,
  type AlignmentRow,
  type ConfidenceRow,
  type BiasRow,
} from "@/lib/engine2-diagnostic-flow-data";
import { cn } from "@/lib/utils";
import { BarChart2, Ban, Download, Trash2 } from "lucide-react";

const STEP1 = ENGINE2_DECISION_FLOW[0];
const STEP2 = ENGINE2_DECISION_FLOW[1];
const STEP3 = ENGINE2_DECISION_FLOW[2];

function rulesFromConfig(c: Engine2LogicConfig): { step1: string[]; step2: string[]; step3: string[] } {
  return {
    step1: [
      `alignment_score >= ${c.alignment_strong}  → STRONG`,
      `Else if alignment_score >= ${c.alignment_moderate}  → MODERATE`,
      `Else if alignment_score >= ${c.alignment_weak}  → WEAK`,
      `Else  → DISALIGNED`,
    ],
    step2: [
      `stack >= ${c.conf_high_stack} AND alignment_score >= ${c.conf_high_align}  → HIGH`,
      `Else if stack >= ${c.conf_medium_stack}  → MEDIUM`,
      `Else  → LOW`,
    ],
    step3: [
      `wave3_prob >= ${c.bias_cont_wave3} AND wave_number == 3 AND momentum >= ${c.bias_cont_momentum}  → CONTINUATION`,
      `wave5_exh >= ${c.bias_exh_wave5} AND wave_number == 5 AND divergence_risk >= ${c.bias_exh_div_risk}  → EXHAUSTION`,
      `Else  → NEUTRAL`,
    ],
  };
}

function getTotalBars(d: DiagnosticsApiResult["distribution"]): number {
  const counts = Object.values(d.alignment_state).map((x) => x.count);
  return Math.max(0, ...counts) || 0;
}

function getDominant(rec: Record<string, { count: number; pct: number }>, order: string[]): string {
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

function apiResultToFlowRow(api: DiagnosticsApiResult, tf: TimeframeKey): TimeframeDiagnostic {
  const bars = getTotalBars(api.distribution);
  const align = api.distribution.alignment_state;
  const conf = api.distribution.confidence_level;
  const bias = api.distribution.dominant_bias;
  const toAlignRow = (state: "STRONG" | "MODERATE" | "WEAK" | "DISALIGNED"): AlignmentRow => {
    const pct = align[state]?.pct ?? 0;
    const maxPct = Math.max(...["STRONG", "MODERATE", "WEAK", "DISALIGNED"].map((s) => align[s]?.pct ?? 0));
    return { state, pct, unreachable: pct === 0, dominant: pct > 0 && pct === maxPct };
  };
  const toConfRow = (state: "HIGH" | "MEDIUM" | "LOW"): ConfidenceRow => {
    const pct = conf[state]?.pct ?? 0;
    return { state, pct, unreachable: pct === 0 };
  };
  const toBiasRow = (state: "NEUTRAL" | "CONTINUATION" | "EXHAUSTION"): BiasRow => {
    const pct = bias[state]?.pct ?? 0;
    const maxPct = Math.max(...["NEUTRAL", "CONTINUATION", "EXHAUSTION"].map((s) => bias[s]?.pct ?? 0));
    return { state, pct, dominant: pct > 0 && pct === maxPct, unreachable: pct === 0 };
  };
  const primaryStrong = api.gatingAnalysis.strongAlignment[0];
  const primaryCont = api.gatingAnalysis.continuationBias[0];
  return {
    timeframe: tf,
    bars,
    dominantAlignment: getDominant(align, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]),
    dominantConfidence: getDominant(conf, ["HIGH", "MEDIUM", "LOW"]),
    dominantBias: getDominant(bias, ["CONTINUATION", "EXHAUSTION", "NEUTRAL"]),
    step1: {
      outcomes: ["WEAK", "MODERATE", "DISALIGNED", "STRONG"].map((s) => toAlignRow(s as AlignmentRow["state"])),
      blockers: { primary: { label: primaryStrong?.label ?? "alignment_score", pct: primaryStrong?.pct ?? 0 } },
    },
    step2: {
      outcomes: ["HIGH", "MEDIUM", "LOW"].map((s) => toConfRow(s as ConfidenceRow["state"])),
      blockers: {
        blockingFrequency: api.gatingAnalysis.highConfidence.slice(0, 3).map((x) => ({
          label: x.label,
          blocks: "HIGH",
          pct: x.pct,
        })),
      },
    },
    step3: {
      outcomes: ["NEUTRAL", "CONTINUATION", "EXHAUSTION"].map((s) => toBiasRow(s as BiasRow["state"])),
      blockers: {
        primaryBlockers: api.gatingAnalysis.continuationBias.slice(0, 3).map((x) => x.label),
      },
    },
  };
}

/** Step 1 column order: W / M / D / S */
const ALIGN_ORDER = ["WEAK", "MODERATE", "DISALIGNED", "STRONG"] as const;

/** Step 2: HIGH, MEDIUM, LOW */
const CONF_ORDER = ["HIGH", "MEDIUM", "LOW"] as const;

/** Step 3: NEUTRAL, CONTINUATION, EXHAUSTION */
const BIAS_ORDER = ["NEUTRAL", "CONTINUATION", "EXHAUSTION"] as const;

const DEFAULT_LOAD_SYMBOL = "KCEX_ETHUSDT.P";

export default function Engine2DiagnosticFlowPage() {
  const [versionLabel, setVersionLabel] = useState<string>("Default");
  const [activeConfig, setActiveConfig] = useState<ReturnType<typeof getConfig> | null>(null);
  const [flowData, setFlowData] = useState<Record<TimeframeKey, TimeframeDiagnostic> | null>(null);
  const [loadSymbol, setLoadSymbol] = useState(DEFAULT_LOAD_SYMBOL);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncVersion = useCallback(() => {
    const store = getVersionStore();
    const activeId = store.activeVersionId;
    setVersionLabel(
      activeId === null ? "Default" : store.versions.find((v) => v.id === activeId)?.name ?? activeId
    );
    setActiveConfig(getConfig(getActiveOverrides()));
  }, []);

  useEffect(() => {
    syncVersion();
    window.addEventListener("focus", syncVersion);
    return () => window.removeEventListener("focus", syncVersion);
  }, [syncVersion]);

  const handleLoad = useCallback(async () => {
    const symbol = loadSymbol.trim() || DEFAULT_LOAD_SYMBOL;
    setLoadError(null);
    setLoadLoading(true);
    const overridesFragment = getActiveOverridesQueryFragment();
    try {
      const results = await Promise.all(
        TIMEFRAME_ORDER.map(async (tf) => {
          const params = new URLSearchParams({ symbol, timeframe: tf, limit: "5000" });
          const res = await fetch(`/api/alignment-engine/diagnostics?${params}${overridesFragment}`);
          if (!res.ok) throw new Error(`${tf}: ${res.status}`);
          const body = (await res.json()) as DiagnosticsApiResult | { error?: string };
          if ("error" in body && body.error) throw new Error(body.error);
          return { tf, data: body as DiagnosticsApiResult };
        })
      );
      const next: Record<TimeframeKey, TimeframeDiagnostic> = {} as Record<TimeframeKey, TimeframeDiagnostic>;
      for (const { tf, data } of results) next[tf] = apiResultToFlowRow(data, tf);
      setFlowData(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
      setFlowData(null);
    } finally {
      setLoadLoading(false);
    }
  }, [loadSymbol]);

  const handleClear = useCallback(() => {
    setFlowData(null);
    setLoadError(null);
  }, []);

  const displayData = flowData ?? PER_TF_DIAGNOSTIC;
  const rules = activeConfig ? rulesFromConfig(activeConfig) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="size-6 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold">Engine 2 — Diagnostic flow</h1>
              <p className="text-sm text-muted-foreground">
                Each step: one row per timeframe, outcomes in columns. Same format as all-timeframes layout.
              </p>
            </div>
          </div>
          <Engine2Nav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {/* Version in use + active thresholds + Load / Clear */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Version in use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Logic applied to interpretations site-wide: <span className="font-semibold">{versionLabel}</span>
              {" · "}
              <Link href="/engine2-tune" className="text-primary underline">
                Change in Tune
              </Link>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Symbol"
                value={loadSymbol}
                onChange={(e) => setLoadSymbol(e.target.value)}
                className="h-8 w-44 font-mono text-sm"
              />
              <Button size="sm" onClick={handleLoad} disabled={loadLoading}>
                <Download className="mr-1.5 size-3.5" />
                {loadLoading ? "Loading…" : "Load"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleClear} disabled={loadLoading}>
                <Trash2 className="mr-1.5 size-3.5" />
                Clear
              </Button>
            </div>
            {loadError && <p className="text-sm text-destructive">{loadError}</p>}
            {flowData && <p className="text-sm text-muted-foreground">Showing loaded data for {loadSymbol.trim() || DEFAULT_LOAD_SYMBOL} (current version).</p>}
            {activeConfig && (
              <div className="rounded-md border border-border bg-muted/30 font-mono text-xs">
                <p className="mb-1.5 px-2 pt-2 text-muted-foreground">Active thresholds (alignment → confidence → bias)</p>
                <table className="w-full border-collapse">
                  <tbody>
                    {ENGINE2_LOGIC_ENTRIES.filter(
                      (e) =>
                        e.category === "alignment" ||
                        e.category === "confidence" ||
                        e.category === "stack" ||
                        e.category === "bias"
                    ).map((entry) => (
                      <tr key={entry.key} className="border-t border-border/50">
                        <td className="py-1 pr-3 pl-2 text-muted-foreground">{entry.key}</td>
                        <td className="py-1 pr-2 tabular-nums">{activeConfig[entry.key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 1 — Alignment state: table TF | Bars | W | M | D | S */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Step 1 — {STEP1.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Rules
              </p>
              <pre className="whitespace-pre rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {rules ? rules.step1.join("\n") : STEP1.ladder.map((r) => `${r.condition}  ${r.outcome}`).join("\n")}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Observed distribution
              </p>
              <div className="overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                      <TableHead className="w-14 p-1 text-right text-[11px]">Bars</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">W</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">M</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">D</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">S</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TIMEFRAME_ORDER.map((tfKey) => {
                      const d = displayData[tfKey];
                      const outcomes = d.step1.outcomes;
                      const byState = Object.fromEntries(outcomes.map((o) => [o.state, o]));
                      const maxPct = Math.max(...outcomes.map((o) => o.pct));
                      return (
                        <TableRow key={tfKey}>
                          <TableCell className="p-1 text-[11px] font-medium">{tfKey}</TableCell>
                          <TableCell className="p-1 text-right text-[11px] tabular-nums text-muted-foreground">
                            {d.bars}
                          </TableCell>
                          {ALIGN_ORDER.map((state) => {
                            const o = byState[state];
                            const pct = o?.pct ?? 0;
                            const unreachable = pct === 0;
                            const dominant = pct > 0 && pct === maxPct;
                            return (
                              <TableCell
                                key={state}
                                className={cn(
                                  "p-1 text-right text-[11px] tabular-nums",
                                  unreachable && "text-destructive",
                                  dominant && "font-semibold"
                                )}
                              >
                                {unreachable ? (
                                  <>
                                    <Ban className="inline size-3 align-middle" /> {pct.toFixed(1)}
                                  </>
                                ) : (
                                  pct.toFixed(1)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2 — Confidence: table TF | Bars | HIGH | MEDIUM | LOW */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Step 2 — {STEP2.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Rules
              </p>
              <pre className="whitespace-pre rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {rules ? rules.step2.join("\n") : STEP2.ladder.map((r) => `${r.condition}  ${r.outcome}`).join("\n")}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Observed outcomes
              </p>
              <div className="overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                      <TableHead className="w-14 p-1 text-right text-[11px]">Bars</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">HIGH</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">MEDIUM</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">LOW</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TIMEFRAME_ORDER.map((tfKey) => {
                      const d = displayData[tfKey];
                      const outcomes = d.step2.outcomes;
                      const byState = Object.fromEntries(outcomes.map((o) => [o.state, o]));
                      const maxPct = Math.max(...outcomes.map((o) => o.pct));
                      return (
                        <TableRow key={tfKey}>
                          <TableCell className="p-1 text-[11px] font-medium">{tfKey}</TableCell>
                          <TableCell className="p-1 text-right text-[11px] tabular-nums text-muted-foreground">
                            {d.bars}
                          </TableCell>
                          {CONF_ORDER.map((state) => {
                            const o = byState[state];
                            const pct = o?.pct ?? 0;
                            const unreachable = pct === 0;
                            const dominant = pct > 0 && pct === maxPct;
                            return (
                              <TableCell
                                key={state}
                                className={cn(
                                  "p-1 text-right text-[11px] tabular-nums",
                                  unreachable && "text-destructive",
                                  dominant && "font-semibold"
                                )}
                              >
                                {unreachable ? (
                                  <>
                                    <Ban className="inline size-3 align-middle" /> {pct.toFixed(1)}
                                  </>
                                ) : (
                                  pct.toFixed(1)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 — Bias: table TF | Bars | NEUTRAL | CONTINUATION | EXHAUSTION */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Step 3 — {STEP3.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Rules
              </p>
              <pre className="whitespace-pre rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {rules ? rules.step3.join("\n") : STEP3.ladder.map((r) => `${r.condition}  ${r.outcome}`).join("\n")}
              </pre>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wider">
                Observed bias
              </p>
              <div className="overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                      <TableHead className="w-14 p-1 text-right text-[11px]">Bars</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">N</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">C</TableHead>
                      <TableHead className="min-w-[72px] p-1 text-right text-[11px]">E</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TIMEFRAME_ORDER.map((tfKey) => {
                      const d = displayData[tfKey];
                      const outcomes = d.step3.outcomes;
                      const byState = Object.fromEntries(outcomes.map((o) => [o.state, o]));
                      const maxPct = Math.max(...outcomes.map((o) => o.pct));
                      return (
                        <TableRow key={tfKey}>
                          <TableCell className="p-1 text-[11px] font-medium">{tfKey}</TableCell>
                          <TableCell className="p-1 text-right text-[11px] tabular-nums text-muted-foreground">
                            {d.bars}
                          </TableCell>
                          {BIAS_ORDER.map((state) => {
                            const o = byState[state];
                            const pct = o?.pct ?? 0;
                            const unreachable = pct === 0;
                            const dominant = pct > 0 && pct === maxPct;
                            return (
                              <TableCell
                                key={state}
                                className={cn(
                                  "p-1 text-right text-[11px] tabular-nums",
                                  unreachable && "text-destructive",
                                  dominant && "font-semibold"
                                )}
                                title={state}
                              >
                                {unreachable ? (
                                  <>
                                    <Ban className="inline size-3 align-middle" /> {pct.toFixed(1)}
                                  </>
                                ) : (
                                  pct.toFixed(1)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pb-8 text-sm text-muted-foreground">
          {flowData
            ? "Loaded data using current version. Rules and tables reflect active thresholds."
            : "Static example data. Use Load to fetch diagnostics with the current version."}{" "}
          W/M/D/S = Weak, Moderate, Disaligned, Strong. N/C/E = Neutral, Continuation, Exhaustion. Bold = dominant; red + icon = unreachable.
        </div>
      </main>
    </div>
  );
}
