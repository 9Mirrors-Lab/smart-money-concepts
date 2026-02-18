"use client";

import { useCallback, useState, Fragment, forwardRef, useImperativeHandle, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DiagnosticsApiResult } from "@/components/diagnostics-panel";
import { Lock, Ban, ChevronDown, ChevronRight } from "lucide-react";

const ALIGNMENT_ORDER = ["WEAK", "DISALIGNED", "MODERATE", "STRONG"] as const;
/** Grid 1 display order: W · M · D · S */
const ALIGN_DISPLAY_ORDER = ["WEAK", "MODERATE", "DISALIGNED", "STRONG"] as const;
const CONFIDENCE_ORDER = ["LOW", "MEDIUM", "HIGH"] as const;
const BIAS_ORDER = ["NEUTRAL", "CONTINUATION", "EXHAUSTION"] as const;
const TIMEFRAME_ORDER = ["1M", "1W", "1D", "360", "90", "23"];

const ALIGN_SHORT: Record<string, string> = { WEAK: "W", DISALIGNED: "D", MODERATE: "M", STRONG: "S" };
const CONF_SHORT: Record<string, string> = { LOW: "L", MEDIUM: "M", HIGH: "H" };
const BIAS_SHORT: Record<string, string> = { NEUTRAL: "N", CONTINUATION: "C", EXHAUSTION: "E" };

function getTotalBars(d: DiagnosticsApiResult["distribution"]): number {
  const counts = Object.values(d.alignment_state).map((x) => x.count);
  return Math.max(0, ...counts) || 0;
}

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

/** Behavior summary lines (same as run-query diagnostics). */
function buildSummaryLines(d: DiagnosticsApiResult, timeframe: string): string[] {
  const align = getDominant(d.distribution.alignment_state, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]);
  const conf = getDominant(d.distribution.confidence_level, ["HIGH", "MEDIUM", "LOW"]);
  const bias = getDominant(d.distribution.dominant_bias, ["CONTINUATION", "EXHAUSTION", "NEUTRAL"]);
  const strongPct = d.distribution.alignment_state.STRONG?.pct ?? 0;
  const highPct = d.distribution.confidence_level.HIGH?.pct ?? 0;
  const neutralPct = d.distribution.dominant_bias.NEUTRAL?.pct ?? 0;
  const lines: string[] = [];
  lines.push(`Predominantly ${align} with ${conf} confidence.`);
  if (strongPct === 0) lines.push("STRONG does not occur.");
  if (highPct === 0) lines.push("HIGH confidence does not occur.");
  if (neutralPct >= 80) lines.push("NEUTRAL dominates; CONT/EXH rare.");
  else if (bias !== "NEUTRAL") lines.push(`${bias}; NEUTRAL ${(100 - neutralPct).toFixed(0)}%.`);
  return lines;
}

/** Suggested interpretation (same logic as run-query). */
function getSuggested(d: DiagnosticsApiResult, timeframe: string): string {
  const align = d.distribution.alignment_state;
  const conf = d.distribution.confidence_level;
  const bias = d.distribution.dominant_bias;
  const weakPct = align.WEAK?.pct ?? 0;
  const lowPct = conf.LOW?.pct ?? 0;
  const strongPct = align.STRONG?.pct ?? 0;
  const highPct = conf.HIGH?.pct ?? 0;
  const neutralPct = bias.NEUTRAL?.pct ?? 0;
  const stackLow = d.multiTfStackBands["< 0.4"]?.pct ?? 0;
  if (weakPct >= 70 && lowPct >= 90) return "Confirmatory TF, not signal generator.";
  if (strongPct === 0 && highPct === 0 && stackLow >= 90) return "Stronger states need higher-TF participation.";
  if (weakPct >= 50 || lowPct >= 50) return "WEAK/LOW baseline; deviations meaningful.";
  if (neutralPct >= 85) return "Filter, not bias selector.";
  return "Mixed; review gating.";
}

/** Why blocked: top 3 blockers per category, as lines. */
function formatWhyBlocked(d: DiagnosticsApiResult): { strong: string[]; high: string[]; cont: string[] } {
  const strong = d.gatingAnalysis.strongAlignment.slice(0, 3).map((x) => `${x.label} → blocks ${x.pct}%`);
  const high = d.gatingAnalysis.highConfidence.slice(0, 3).map((x) => `${x.label} → blocks ${x.pct}%`);
  const cont = d.gatingAnalysis.continuationBias.slice(0, 3).map((x) => `${x.label} → blocks ${x.pct}%`);
  return { strong, high, cont };
}

/** Grid 2: Get single blocker pct by label match or first. */
function getGatingPcts(d: DiagnosticsApiResult): { strong: number; high: number; med: number; cont: number } {
  const findPct = (list: { label: string; pct: number }[], match: string) =>
    list.find((x) => x.label.toLowerCase().includes(match))?.pct ?? list[0]?.pct ?? 0;
  return {
    strong: d.gatingAnalysis.strongAlignment[0]?.pct ?? 0,
    high: findPct(d.gatingAnalysis.highConfidence, "0.7"),
    med: findPct(d.gatingAnalysis.highConfidence, "0.4"),
    cont: d.gatingAnalysis.continuationBias[0]?.pct ?? 0,
  };
}

/** Grid 3: Signal density from CONT + EXH + divergence. */
function getSignalDensity(d: DiagnosticsApiResult): "Low" | "Medium" | "High" {
  const cont = d.distribution.wave3_continuation_count;
  const exh = d.distribution.wave5_exhaustion_count;
  const div = d.distribution.divergence_warning_count;
  const signal = cont + exh;
  if (signal >= 150 && div <= 5) return "High";
  if (signal >= 80 || div >= 4) return "Medium";
  return "Low";
}

/** Grid 4: Role and description per spec (fixed per timeframe). */
const TF_ROLES: Record<string, { role: string; description: string }> = {
  "1M": { role: "Expressive", description: "Shows early deviations; noisy" },
  "1W": { role: "Confirmatory", description: "Filters structure; not a trigger" },
  "1D": { role: "Transitional", description: "Best balance of signal + structure" },
  "360": { role: "Confirmatory", description: "Structural validation only" },
  "90": { role: "Transitional", description: "Execution-adjacent" },
  "23": { role: "Confirmatory", description: "Micro-confirmation, not signal" },
};
function getRole(_d: DiagnosticsApiResult, tf: string): { role: string; description: string } {
  return TF_ROLES[tf] ?? { role: "—", description: "—" };
}

/** Dominant state label e.g. WEAK / LOW */
function getDominantState(d: DiagnosticsApiResult): string {
  const align = getDominant(d.distribution.alignment_state, ["STRONG", "MODERATE", "WEAK", "DISALIGNED"]);
  const conf = getDominant(d.distribution.confidence_level, ["HIGH", "MEDIUM", "LOW"]);
  return `${align} / ${conf}`;
}

type RowState = { data: DiagnosticsApiResult } | { error: string };

/** Build markdown snapshot of all four grids from current rows. */
function buildGridMarkdown(
  rows: Record<string, RowState>,
  symbol: string
): string {
  const lines: string[] = [
    `# Engine 2 Diagnostics — Comparative View`,
    `**${symbol}** · ${new Date().toISOString().slice(0, 19)}Z`,
    "",
  ];
  const tfList = TIMEFRAME_ORDER;

  const data = (tf: string) => {
    const r = rows[tf];
    if (!r || "error" in r) return null;
    return r.data;
  };

  lines.push("## Cross-Timeframe Outcome Distribution Grid");
  lines.push("");
  lines.push("| TF | Bars | Alignment (W/M/D/S) | Confidence (L/M/H) | Bias (N/C/E) | Dominant State |");
  lines.push("|----|------|--------------------|-------------------|--------------|----------------|");
  for (const tf of tfList) {
    const d = data(tf);
    if (!d) {
      lines.push(`| ${tf} | — | ${(rows[tf] as { error: string })?.error ?? "—"} |`);
      continue;
    }
    const a = d.distribution.alignment_state;
    const c = d.distribution.confidence_level;
    const b = d.distribution.dominant_bias;
    const alignStr = [...ALIGN_DISPLAY_ORDER].map((k) => `${ALIGN_SHORT[k]} ${(a[k]?.pct ?? 0).toFixed(1)}`).join(" · ");
    const confStr = CONFIDENCE_ORDER.map((k) => `${CONF_SHORT[k]} ${(c[k]?.pct ?? 0).toFixed(1)}`).join(" · ");
    const biasStr = BIAS_ORDER.map((k) => `${BIAS_SHORT[k] ?? k} ${(b[k]?.pct ?? 0).toFixed(1)}`).join(" · ");
    const bars = getTotalBars(d.distribution);
    lines.push(`| ${tf} | ${bars} | ${alignStr} | ${confStr} | ${biasStr} | ${getDominantState(d)} |`);
  }
  lines.push("");

  lines.push("## Cross-Timeframe Gating & Constraint Grid");
  lines.push("");
  lines.push("| TF | STRONG blocked | HIGH conf blocked | MED conf blocked | CONT blocked |");
  lines.push("|----|----------------|-------------------|------------------|--------------|");
  for (const tf of tfList) {
    const d = data(tf);
    if (!d) {
      lines.push(`| ${tf} | — |`);
      continue;
    }
    const g = getGatingPcts(d);
    lines.push(`| ${tf} | ${g.strong.toFixed(1)}% | ${g.high.toFixed(1)}% | ${g.med.toFixed(1)}% | ${g.cont.toFixed(1)}% |`);
  }
  lines.push("");

  lines.push("## Rare / Reachable Signal Density");
  lines.push("");
  lines.push("| TF | CONT occurrences | EXHAUST occurrences | Divergence warnings | Signal Density |");
  lines.push("|----|------------------|---------------------|---------------------|----------------|");
  for (const tf of tfList) {
    const d = data(tf);
    if (!d) {
      lines.push(`| ${tf} | — |`);
      continue;
    }
    const dist = d.distribution;
    lines.push(`| ${tf} | ${dist.wave3_continuation_count} | ${dist.wave5_exhaustion_count} | ${dist.divergence_warning_count} | ${getSignalDensity(d)} |`);
  }
  lines.push("");

  lines.push("## Cross-Timeframe Role Classification");
  lines.push("");
  lines.push("| TF | Role | Description |");
  lines.push("|----|------|-------------|");
  for (const tf of tfList) {
    const d = data(tf);
    const { role, description } = d ? getRole(d, tf) : TF_ROLES[tf] ?? { role: "—", description: "—" };
    lines.push(`| ${tf} | ${role} | ${description} |`);
  }

  return lines.join("\n");
}

export interface AggregateDiagnosticsPanelProps {
  symbol: string;
  onStateChange?: (state: { loading: boolean; hasResults: boolean; copyStatus: "idle" | "copied" }) => void;
}

export interface AggregateDiagnosticsPanelHandle {
  runAll: () => void;
  exportMarkdown: () => void;
  hasResults: boolean;
  loading: boolean;
  copyStatus: "idle" | "copied";
}

export const AggregateDiagnosticsPanel = forwardRef<
  AggregateDiagnosticsPanelHandle,
  AggregateDiagnosticsPanelProps
>(function AggregateDiagnosticsPanel({ symbol, onStateChange }, ref) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [expandedTfs, setExpandedTfs] = useState<Set<string>>(() => new Set(TIMEFRAME_ORDER));
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const toggleTf = useCallback((tf: string) => {
    setExpandedTfs((prev) => {
      const next = new Set(prev);
      if (next.has(tf)) next.delete(tf);
      else next.add(tf);
      return next;
    });
  }, []);

  const exportMarkdown = useCallback(() => {
    const md = buildGridMarkdown(rows, symbol);
    void navigator.clipboard.writeText(md).then(() => {
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    });
  }, [rows, symbol]);

  const runAll = useCallback(() => {
    if (!symbol) return;
    setLoading(true);
    const limit = "5000";
    Promise.all(
      TIMEFRAME_ORDER.map((tf) => {
        const params = new URLSearchParams({ symbol, timeframe: tf, limit });
        return fetch(`/api/alignment-engine/diagnostics?${params}`)
          .then((r) => r.json())
          .then((body: DiagnosticsApiResult | { error?: string; detail?: string }) => {
            if ("error" in body && body.error)
              return { tf, result: { error: body.detail ?? body.error } as RowState };
            return { tf, result: { data: body as DiagnosticsApiResult } as RowState };
          })
          .catch((e) => ({
            tf,
            result: { error: e instanceof Error ? e.message : "Failed" } as RowState,
          }));
      })
    ).then((pairs) => {
      const next: Record<string, RowState> = {};
      for (const { tf, result } of pairs) next[tf] = result;
      setRows(next);
      setLoading(false);
    });
  }, [symbol]);

  const hasResults = Object.keys(rows).length > 0;

  useImperativeHandle(
    ref,
    () => ({
      runAll,
      exportMarkdown,
      hasResults,
      loading,
      copyStatus,
    }),
    [runAll, exportMarkdown, hasResults, loading, copyStatus]
  );

  useEffect(() => {
    onStateChange?.({ loading, hasResults, copyStatus });
  }, [loading, hasResults, copyStatus, onStateChange]);

  const nBars = (tf: string) => {
    const r = rows[tf];
    if (!r || "error" in r) return null;
    return getTotalBars(r.data.distribution);
  };
  /** Distribution percentage for comparison columns. */
  const distPct = (tf: string, kind: "alignment_state" | "confidence_level" | "dominant_bias", key: string): number | null => {
    const r = rows[tf];
    if (!r || "error" in r) return null;
    const rec = r.data.distribution[kind];
    return rec[key]?.pct ?? 0;
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">
          Engine 2 Diagnostics — Comparative View
        </h3>
        <p className="text-xs text-muted-foreground">
          {symbol} · Cross-timeframe outcome, gating, signal density, and role classification.
        </p>
      </div>

      {!hasResults && !loading && (
        <p className="text-xs text-muted-foreground">
          Click “Run all timeframes” to fetch diagnostics for 1M, 1W, 1D, 360, 90, 23.
        </p>
      )}

      {hasResults && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto pb-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
          <section className="min-w-0 rounded-md border border-border bg-card p-2">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Outcome Distribution
            </h4>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                    <TableHead className="w-10 p-1 text-right text-[11px]">Bars</TableHead>
                    <TableHead className="min-w-[120px] p-1 text-[11px]">W/M/D/S</TableHead>
                    <TableHead className="min-w-[90px] p-1 text-[11px]">L/M/H</TableHead>
                    <TableHead className="min-w-[90px] p-1 text-[11px]">N/C/E</TableHead>
                    <TableHead className="min-w-[80px] p-1 text-[11px]">Dominant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TIMEFRAME_ORDER.map((tf) => {
                    const r = rows[tf];
                    const err = r && "error" in r ? r.error : null;
                    const data = r && "data" in r ? r.data : null;
                    const bars = nBars(tf);
                    if (err) {
                      return (
                        <TableRow key={tf}>
                          <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                          <TableCell className="p-1 text-right text-[11px]">—</TableCell>
                          <TableCell colSpan={4} className="p-1 text-[11px] text-destructive">{err}</TableCell>
                        </TableRow>
                      );
                    }
                    if (!data) return null;
                    const alignRec = data.distribution.alignment_state;
                    const confRec = data.distribution.confidence_level;
                    const biasRec = data.distribution.dominant_bias;
                    const formatCompact = (
                      rec: Record<string, { count: number; pct: number }>,
                      order: readonly string[],
                      shortMap: Record<string, string>
                    ) => {
                      const parts = order.map((k) => {
                        const pct = rec[k]?.pct ?? 0;
                        const count = rec[k]?.count ?? 0;
                        const label = `${shortMap[k] ?? k} ${pct.toFixed(1)}`;
                        const tag = pct === 0 ? "Unreachable" : pct >= 50 ? "Dominant" : pct < 5 ? "Rare" : "Expected";
                        return { label, pct, count, tag };
                      });
                      const maxPct = Math.max(...parts.map((p) => p.pct));
                      return parts.map((p, i) => (
                        <span key={i} title={`${p.tag} · n=${p.count}`}>
                          {i > 0 && " · "}
                          {p.pct === 0 ? (
                            <span className="text-destructive" title="Unreachable">
                              <Ban className="inline size-3" /> {p.label}
                            </span>
                          ) : p.pct < 5 ? (
                            <span className="text-muted-foreground">{p.label}</span>
                          ) : p.pct === maxPct ? (
                            <span className="font-semibold">{p.label}</span>
                          ) : (
                            <span>{p.label}</span>
                          )}
                        </span>
                      ));
                    };
                    return (
                      <TableRow key={tf}>
                        <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                        <TableCell className="p-1 text-right text-[11px] tabular-nums text-muted-foreground">{bars ?? "—"}</TableCell>
                        <TableCell className="p-1 text-[11px]">{formatCompact(alignRec, [...ALIGN_DISPLAY_ORDER], ALIGN_SHORT)}</TableCell>
                        <TableCell className="p-1 text-[11px]">{formatCompact(confRec, CONFIDENCE_ORDER, CONF_SHORT)}</TableCell>
                        <TableCell className="p-1 text-[11px]">{formatCompact(biasRec, BIAS_ORDER, BIAS_SHORT)}</TableCell>
                        <TableCell className="p-1 text-[11px] font-medium">{getDominantState(data)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-border bg-card p-2">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gating & Constraint
            </h4>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                    <TableHead className="min-w-[70px] p-1 text-right text-[11px]" title="alignment_score < 0.75">STR</TableHead>
                    <TableHead className="min-w-[70px] p-1 text-right text-[11px]" title="stack < 0.7">HIGH</TableHead>
                    <TableHead className="min-w-[70px] p-1 text-right text-[11px]" title="stack < 0.4">MED</TableHead>
                    <TableHead className="min-w-[70px] p-1 text-right text-[11px]" title="wave3 < 0.6">CONT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TIMEFRAME_ORDER.map((tf) => {
                    const r = rows[tf];
                    const err = r && "error" in r;
                    const data = r && "data" in r ? r.data : null;
                    if (err || !data) {
                      return (
                        <TableRow key={tf}>
                          <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                          <TableCell colSpan={4} className={cn("p-1 text-[11px]", err ? "text-destructive" : "text-muted-foreground")}>
                            {err ? (rows[tf] as { error: string }).error : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const g = getGatingPcts(data);
                    const cell = (pct: number, title: string) => {
                      const is100 = pct >= 99.5;
                      const intensity = Math.min(1, pct / 100);
                      return (
                        <TableCell
                          key={title}
                          className={cn(
                            "p-1 text-right text-[11px] tabular-nums",
                            intensity > 0.5 && "bg-amber-500/10",
                            intensity >= 0.95 && "bg-amber-500/20"
                          )}
                          title={title}
                        >
                          {is100 ? <Lock className="inline size-3 text-muted-foreground" /> : null}{" "}
                          {pct.toFixed(1)}%
                        </TableCell>
                      );
                    };
                    return (
                      <TableRow key={tf}>
                        <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                        {cell(g.strong, "STRONG blocked")}
                        {cell(g.high, "HIGH blocked")}
                        {cell(g.med, "MED blocked")}
                        {cell(g.cont, "CONT blocked")}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
          <section className="min-w-0 rounded-md border border-border bg-card p-2">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rare / Reachable Signal Density
            </h4>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                    <TableHead className="w-14 p-1 text-right text-[11px]">CONT</TableHead>
                    <TableHead className="w-14 p-1 text-right text-[11px]">EXH</TableHead>
                    <TableHead className="w-12 p-1 text-right text-[11px]">Div</TableHead>
                    <TableHead className="w-16 p-1 text-right text-[11px]">Density</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TIMEFRAME_ORDER.map((tf) => {
                    const r = rows[tf];
                    const err = r && "error" in r;
                    const data = r && "data" in r ? r.data : null;
                    if (err || !data) {
                      return (
                        <TableRow key={tf}>
                          <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                          <TableCell colSpan={4} className={cn("p-1 text-[11px]", err ? "text-destructive" : "text-muted-foreground")}>
                            {err ? (rows[tf] as { error: string }).error : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const dist = data.distribution;
                    return (
                      <TableRow key={tf}>
                        <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                        <TableCell className="p-1 text-right text-[11px] tabular-nums">{dist.wave3_continuation_count}</TableCell>
                        <TableCell className="p-1 text-right text-[11px] tabular-nums">{dist.wave5_exhaustion_count}</TableCell>
                        <TableCell className="p-1 text-right text-[11px] tabular-nums">{dist.divergence_warning_count}</TableCell>
                        <TableCell className="p-1 text-right text-[11px] font-medium">{getSignalDensity(data)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
          </div>
          <div className="min-w-0">
          <section className="min-w-0 rounded-md border border-border bg-card p-2" aria-label="Role Classification">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Role Classification
            </h4>
            <p className="mb-1 text-[10px] text-muted-foreground">
              All expanded by default. Click TF to collapse/expand Current Bar Breakdown.
            </p>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 p-1 text-[11px]">TF</TableHead>
                    <TableHead className="min-w-[90px] p-1 text-[11px]">Role</TableHead>
                    <TableHead className="min-w-[160px] p-1 text-[11px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TIMEFRAME_ORDER.map((tf) => {
                    const r = rows[tf];
                    const err = r && "error" in r;
                    const data = r && "data" in r ? r.data : null;
                    const isExpanded = expandedTfs.has(tf);
                    const canExpand = !!data;
                    if (err || !data) {
                      return (
                        <TableRow key={tf}>
                          <TableCell className="p-1 text-[11px] font-medium">{tf}</TableCell>
                          <TableCell colSpan={2} className={cn("p-1 text-[11px]", err ? "text-destructive" : "text-muted-foreground")}>
                            {err ? (rows[tf] as { error: string }).error : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const { role, description } = getRole(data, tf);
                    const { strong: whyStrong, high: whyHigh, cont: whyCont } = formatWhyBlocked(data);
                    return (
                      <Fragment key={tf}>
                        <TableRow
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/60",
                            isExpanded && "bg-muted/40"
                          )}
                          onClick={() => toggleTf(tf)}
                        >
                          <TableCell className="p-1 text-[11px] font-medium">
                            <span className="inline-flex items-center gap-0.5">
                              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              {tf}
                            </span>
                          </TableCell>
                          <TableCell className="p-1 text-[11px] font-medium">{role}</TableCell>
                          <TableCell className="p-1 text-[11px] text-muted-foreground">{description}</TableCell>
                        </TableRow>
                        {isExpanded && canExpand && (
                          <TableRow key={`${tf}-breakdown`} className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={3} className="p-2 text-[11px]">
                              <div className="space-y-1.5 rounded border border-border bg-background p-2">
                                <div className="font-medium text-foreground">Current Bar Breakdown — {tf}</div>
                                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                                  {buildSummaryLines(data, tf).map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                                <div className="grid gap-1.5 text-muted-foreground sm:grid-cols-3">
                                  {whyStrong.length > 0 && (
                                    <div>
                                      <span className="font-medium">Why STR blocked:</span> {whyStrong.join("; ")}
                                    </div>
                                  )}
                                  {whyHigh.length > 0 && (
                                    <div>
                                      <span className="font-medium">Why HIGH blocked:</span> {whyHigh.join("; ")}
                                    </div>
                                  )}
                                  {whyCont.length > 0 && (
                                    <div>
                                      <span className="font-medium">Why CONT blocked:</span> {whyCont.join("; ")}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  <span>
                                    <span className="font-medium">Rare:</span>{" "}
                                    {data.rareStates.rare.length
                                      ? data.rareStates.rare.map((x) => `${x.state}.${x.value} ${x.pct}%`).join("; ")
                                      : "—"}
                                  </span>
                                  <span>
                                    <span className="font-medium">Unreachable:</span>{" "}
                                    {data.rareStates.unreachable.length
                                      ? data.rareStates.unreachable.map((x) => `${x.state}.${x.value}`).join(", ")
                                      : "—"}
                                  </span>
                                </div>
                                <p className="italic text-muted-foreground">
                                  <span className="font-medium">Suggested:</span> {getSuggested(data, tf)}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground">
          Fetching diagnostics for each timeframe…
        </p>
      )}
    </div>
  );
});
