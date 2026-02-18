"use client";

import { useMemo } from "react";
import { formatTimestampEST } from "@/lib/format-time";
import type {
  MarketInterpretation,
  AlignmentState,
  DominantBias,
  ConfidenceLevel,
} from "@/lib/interpretation-engine";

/** Display order for multi-TF: 1M down to 23 (higher TF first). Unknown TFs sort to the end. */
const TIMEFRAME_ORDER = ["1M", "1W", "1D", "360", "90", "23"];

export interface AlignmentPanelProps {
  /** Single-bar interpretation (current frame). */
  interpretation: MarketInterpretation | null;
  /** Multi-TF: one interpretation per timeframe (with timeframe + timestamp). */
  multiTfInterpretations?: (MarketInterpretation & {
    timeframe: string;
    timestamp?: string;
  })[];
  /** When multi-TF view is shown. */
  globalBiasBanner?: string | null;
  loading?: boolean;
  /** Current bar mode: timeframe of the chart (for alignment rail). */
  currentTimeframe?: string | null;
}

const ALIGNMENT_COLORS: Record<AlignmentState, string> = {
  STRONG: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  MODERATE: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  WEAK: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  DISALIGNED: "bg-red-500/20 text-red-400 border-red-500/40",
};

/** Filled dots count: STRONG=4, MODERATE=3, WEAK=2, DISALIGNED=1 */
const ALIGNMENT_FILLED_DOTS: Record<AlignmentState, number> = {
  STRONG: 4,
  MODERATE: 3,
  WEAK: 2,
  DISALIGNED: 1,
};

/** Dot stack color (filled dot and ring for empty). */
const ALIGNMENT_DOT_COLORS: Record<AlignmentState, string> = {
  STRONG: "emerald",
  MODERATE: "amber",
  WEAK: "orange",
  DISALIGNED: "red",
};

/** Bias icon color (currentColor). */
const BIAS_ICON_COLORS: Record<DominantBias, string> = {
  CONTINUATION: "text-emerald-400",
  EXHAUSTION: "text-amber-400",
  NEUTRAL: "text-muted-foreground",
};

const BIAS_TOOLTIPS: Record<DominantBias, string> = {
  CONTINUATION: "CONTINUATION: Energy pushing forward",
  EXHAUSTION: "EXHAUSTION: Push–pull / terminal tension",
  NEUTRAL: "NEUTRAL: No dominant flow",
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  HIGH: "text-emerald-400",
  MEDIUM: "text-amber-400",
  LOW: "text-muted-foreground",
};

function alignmentDotColorClass(color: string, filled: boolean): string {
  if (color === "emerald") return filled ? "bg-emerald-400" : "border border-emerald-500/50 bg-transparent";
  if (color === "amber") return filled ? "bg-amber-400" : "border border-amber-500/50 bg-transparent";
  if (color === "orange") return filled ? "bg-orange-400" : "border border-orange-500/50 bg-transparent";
  if (color === "red") return filled ? "bg-red-400" : "border border-red-500/50 bg-transparent";
  return filled ? "bg-muted-foreground" : "border border-muted-foreground/50 bg-transparent";
}

function buildAlignmentTooltip(interp: MarketInterpretation): string {
  const lines = [
    interp.alignment_state,
    `Confidence: ${interp.confidence_level}`,
    "",
    interp.narrative_summary,
  ];
  if (interp.key_factors.length > 0) {
    lines.push("", "Key factors:", ...interp.key_factors);
  }
  if (interp.warnings.length > 0) {
    lines.push("", "Warnings:", ...interp.warnings);
  }
  return lines.join("\n");
}

/** Bias glyph: same row as dots. Subtle glow when confidence ≥ MEDIUM. Tooltip with meaning. */
function BiasIcon({
  bias,
  confidence,
}: {
  bias: DominantBias;
  confidence: ConfidenceLevel;
}) {
  const colorClass = BIAS_ICON_COLORS[bias];
  const tooltip = BIAS_TOOLTIPS[bias];
  const hasGlow = confidence === "HIGH" || confidence === "MEDIUM";
  const glowClass = hasGlow
    ? "drop-shadow-[0_0_6px_currentColor]"
    : "";

  const size = 20;
  const className = `shrink-0 ${colorClass} ${glowClass}`;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={tooltip}
      aria-label={bias}
    >
      {bias === "CONTINUATION" && (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 11 12 A 4 4 0 0 1 3 12 A 4 4 0 0 1 11 12 M 13 12 A 4 4 0 0 0 21 12 A 4 4 0 0 0 13 12" />
        </svg>
      )}
      {bias === "EXHAUSTION" && (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="18" height="12" rx="2" ry="2" />
          <rect x="20" y="9" width="2" height="6" rx="0.5" fill="currentColor" stroke="none" />
          <rect x="5" y="9" width="3" height="6" fill="currentColor" stroke="none" />
        </svg>
      )}
      {bias === "NEUTRAL" && (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      )}
    </span>
  );
}

/** Horizontal stack of 4 dots: filled = active alignment, empty = missing. Color by state. Tooltip on hover. */
function AlignmentDots({
  state,
  tooltip,
}: {
  state: AlignmentState;
  tooltip: string;
}) {
  const filled = ALIGNMENT_FILLED_DOTS[state];
  const colorName = ALIGNMENT_DOT_COLORS[state];
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={tooltip}
      aria-label={`Alignment: ${state}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 shrink-0 rounded-full ${alignmentDotColorClass(colorName, i < filled)}`}
        />
      ))}
    </span>
  );
}

function StatusChip({
  label,
  colorClass,
  dot = true,
}: {
  label: string;
  colorClass: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />}
      {label}
    </span>
  );
}

function InterpretationBlock({
  interp,
  showTimeframe,
  timeframe,
  timestamp,
}: {
  interp: MarketInterpretation;
  showTimeframe?: boolean;
  timeframe?: string;
  timestamp?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {showTimeframe && timeframe && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {timeframe}
          </span>
          {timestamp != null && (
            <span className="text-[10px] text-muted-foreground">
              {formatTimestampEST(timestamp)}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AlignmentDots
          state={interp.alignment_state}
          tooltip={buildAlignmentTooltip(interp)}
        />
        <BiasIcon
          bias={interp.dominant_bias}
          confidence={interp.confidence_level}
        />
        <span
          className={`text-xs ${CONFIDENCE_COLORS[interp.confidence_level]}`}
        >
          CONF: {interp.confidence_level}
        </span>
      </div>
      <p className="text-xs leading-snug text-foreground/90">
        {interp.narrative_summary}
      </p>
      {interp.key_factors.length > 0 && (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          {interp.key_factors.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      {interp.warnings.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
          <p className="text-xs font-medium text-amber-400">Warnings</p>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-amber-200/90">
            {interp.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const RAIL_ROW_HEIGHT = 24;

function AlignmentRail({
  railMap,
}: {
  railMap: Map<string, { stack_aligned: boolean }>;
}) {
  const filledIndices = TIMEFRAME_ORDER.map((tf, i) =>
    railMap.get(tf)?.stack_aligned ? i : -1
  ).filter((i) => i >= 0);
  const firstFilled = filledIndices[0] ?? -1;
  const lastFilled = filledIndices[filledIndices.length - 1] ?? -1;
  const showRailLine = firstFilled >= 0 && lastFilled > firstFilled;

  return (
    <div className="relative flex shrink-0 flex-col">
      {showRailLine && (
        <div
          className="absolute left-[4px] w-px bg-emerald-500/60"
          style={{
            top: firstFilled * RAIL_ROW_HEIGHT + 4,
            height: (lastFilled - firstFilled) * RAIL_ROW_HEIGHT,
          }}
          aria-hidden
        />
      )}
      {TIMEFRAME_ORDER.map((tf) => {
        const filled = railMap.get(tf)?.stack_aligned ?? false;
        return (
          <div
            key={tf}
            className="flex items-center gap-1.5"
            style={{ height: RAIL_ROW_HEIGHT }}
          >
            <span
              className={`relative z-0 h-2 w-2 shrink-0 rounded-full ${
                filled
                  ? "bg-emerald-400"
                  : "border border-muted-foreground/50 bg-transparent"
              }`}
            />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {tf}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AlignmentPanel({
  interpretation,
  multiTfInterpretations,
  globalBiasBanner,
  loading = false,
  currentTimeframe = null,
}: AlignmentPanelProps) {
  const sortedMultiTf = useMemo(() => {
    if (!multiTfInterpretations?.length) return [];
    const orderIndex = (tf: string) => {
      const i = TIMEFRAME_ORDER.indexOf(tf);
      return i === -1 ? TIMEFRAME_ORDER.length : i;
    };
    return [...multiTfInterpretations].sort(
      (a, b) => orderIndex(a.timeframe) - orderIndex(b.timeframe)
    );
  }, [multiTfInterpretations]);

  const isMultiTf = sortedMultiTf.length > 0;

  const interpByTf = useMemo(() => {
    const m = new Map<string, (typeof sortedMultiTf)[0]>();
    for (const interp of sortedMultiTf) {
      m.set(interp.timeframe, interp);
    }
    return m;
  }, [sortedMultiTf]);

  const railMap = useMemo(() => {
    const m = new Map<string, { stack_aligned: boolean }>();
    if (isMultiTf) {
      for (const [tf, interp] of interpByTf) {
        m.set(tf, { stack_aligned: interp.stack_aligned });
      }
    } else if (interpretation && currentTimeframe) {
      m.set(currentTimeframe, { stack_aligned: interpretation.stack_aligned });
    }
    return m;
  }, [isMultiTf, interpByTf, interpretation, currentTimeframe]);

  const showRail = currentTimeframe != null || isMultiTf;

  if (loading) {
    return (
      <div className="flex gap-3">
        {showRail && <AlignmentRail railMap={new Map()} />}
        <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-medium text-foreground">Alignment</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (isMultiTf) {
    return (
      <div className="flex gap-3">
        <AlignmentRail railMap={railMap} />
        <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-medium text-foreground">
            Alignment · Multi-TF
          </h3>
          {globalBiasBanner && (
            <div
              className={`rounded border px-2 py-1.5 text-xs font-medium ${
                globalBiasBanner.toLowerCase().includes("late-stage") ||
                globalBiasBanner.toLowerCase().includes("risk-aware")
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {globalBiasBanner}
            </div>
          )}
          <div className="flex flex-col gap-4">
            {sortedMultiTf.map((interp, i) => (
              <div
                key={interp.timeframe ?? i}
                className="rounded border border-border/80 bg-background/50 p-2"
              >
                <InterpretationBlock
                  interp={interp}
                  showTimeframe
                  timeframe={interp.timeframe}
                  timestamp={interp.timestamp}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!interpretation) {
    return (
      <div className="flex gap-3">
        {showRail && <AlignmentRail railMap={railMap} />}
        <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-medium text-foreground">Alignment</h3>
          <p className="text-xs text-muted-foreground">
            No alignment data. Run Engine 2 for this symbol and timeframe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {showRail && <AlignmentRail railMap={railMap} />}
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">Alignment</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Current
          </span>
        </div>
        <InterpretationBlock interp={interpretation} />
      </div>
    </div>
  );
}
