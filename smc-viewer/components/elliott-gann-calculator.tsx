"use client";

import { useState, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { calculateElliottGann, type ElliottGannResult } from "@/lib/elliott-gann-calculator";
import { interpretWaves, type WaveNarrative } from "@/lib/narrative-builder";
import { History, MousePointerClick, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartSettings, type CalcClickSlot } from "@/lib/chart-settings-context";

const STORAGE_KEY = "elliott-gann-history";
const MAX_HISTORY = 20;

const WAVE_REFERENCE = [
  { wave: "1 / A", direction: "Trend", level: "0.382", base: "High (A) or Low (1)" },
  { wave: "2 / B", direction: "Reversal", level: "0.236", base: "End of 1 / A" },
  { wave: "3 / C", direction: "Trend", level: "0.485", base: "End of 2 / B" },
  { wave: "4", direction: "Reversal", level: "0.300", base: "End of 3" },
  { wave: "5", direction: "Trend", level: "0.618", base: "End of 4" },
] as const;

export interface StoredCalculation {
  id: number;
  high: number;
  low: number;
  current: number;
  result: ElliottGannResult;
  timestamp: string;
}

function loadHistory(): StoredCalculation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY).filter(
      (x): x is StoredCalculation =>
        typeof x?.id === "number" &&
        typeof x?.high === "number" &&
        typeof x?.low === "number" &&
        typeof x?.current === "number" &&
        x?.result != null &&
        typeof x?.timestamp === "string"
    );
  } catch {
    return [];
  }
}

function saveToHistory(entry: StoredCalculation): StoredCalculation[] {
  const list = loadHistory();
  const next = [entry, ...list].slice(0, MAX_HISTORY);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota or other storage errors
  }
  return next;
}

function formatNum(n: number): string {
  return n.toFixed(2);
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Wave Interpretation UI ───────────────────────────────────────────────────

function WaveInterpretation({ narrative }: { narrative: WaveNarrative }) {
  const isValid = narrative.structureValidity === "valid";

  return (
    <div className="flex flex-col gap-2">
      {/* Structural summary badge */}
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium",
          isValid
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        )}
      >
        {isValid ? (
          <CheckCircle2 className="size-3 shrink-0" />
        ) : (
          <AlertTriangle className="size-3 shrink-0" />
        )}
        <span>{narrative.structuralSummary}</span>
      </div>

      {/* Structural detail */}
      <section className="rounded-md border border-white/10 bg-white/5 p-2">
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Current Structural State
        </h4>
        <p className="text-[11px] leading-relaxed text-[var(--menu-text)]">
          {narrative.structuralDetail}
        </p>
      </section>

      {/* Scenario outlook */}
      <section className="rounded-md border border-white/10 bg-white/5 p-2">
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Scenario Outlook
        </h4>
        <ul className="space-y-1.5">
          {narrative.scenarioBullets.map((bullet, i) => {
            const isBullish = bullet.toLowerCase().startsWith("price holds") || bullet.toLowerCase().includes("bullish");
            const isBearish = bullet.toLowerCase().includes("bearish") || bullet.toLowerCase().includes("breaks below") || bullet.toLowerCase().includes("breaks and closes");
            return (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--menu-text)]">
                {isBearish ? (
                  <TrendingDown className="mt-0.5 size-3 shrink-0 text-red-400" />
                ) : (
                  <TrendingUp className="mt-0.5 size-3 shrink-0 text-emerald-400" />
                )}
                <span>{bullet}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Risk context — only shown when proximity flag is active */}
      {narrative.riskContext && (
        <section className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-snug text-amber-400">
              {narrative.riskContext}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Result blocks ────────────────────────────────────────────────────────────

function ResultBlocks({ result, current }: { result: ElliottGannResult; current: number }) {
  const narrative = interpretWaves(result, current);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <section className="min-w-0 rounded-md border border-white/10 bg-white/5 p-2">
        {(() => {
          const colon = result.advice.indexOf(": ");
          const cycleLabel = colon >= 0 ? result.advice.slice(0, colon + 1).replace(/:$/, "") : result.advice;
          const moveText = colon >= 0 ? result.advice.slice(colon + 2) : "";
          const slSplit = moveText.includes(" SL ") ? moveText.split(" SL ", 2) : [moveText, ""];
          const sellAtLine = slSplit[0]?.trim() ?? "";
          const slLine = slSplit[1]?.trim() ? `SL ${slSplit[1].trim()}` : "";
          return (
            <>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {cycleLabel}
              </h4>
              <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {sellAtLine && <div className="tabular-nums">{sellAtLine}</div>}
                {slLine && <div className="tabular-nums">{slLine}</div>}
              </div>
            </>
          );
        })()}
      </section>
      <section className="min-w-0 rounded-md border border-white/10 bg-white/5 p-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0">
          <div>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Impulsive
            </h4>
            <div className="space-y-0.5 text-[11px]">
              {(["w1", "w2", "w3", "w4", "w5"] as const).map((k) => (
                <div key={k} className="flex items-baseline gap-1.5">
                  <span className="w-7 shrink-0 font-medium text-foreground/90">{k.toUpperCase()}</span>
                  <span className="tabular-nums font-medium">{formatNum(result[k])}</span>
                </div>
              ))}
            </div>
            {result.showW5Expansion && result.w5Expansion != null && (
              <p className="mt-1 border-t border-white/10 pt-1 text-[10px] text-muted-foreground">
                Wave-5 expansion will continue till{" "}
                <span className="tabular-nums font-medium text-foreground">{formatNum(result.w5Expansion)}</span>
              </p>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Corrective
            </h4>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex items-baseline gap-1.5">
                <span className="w-7 shrink-0 font-medium text-foreground/90">WA</span>
                <span className="tabular-nums font-medium">{formatNum(result.wa)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-7 shrink-0 font-medium text-foreground/90">WB</span>
                <span className="tabular-nums font-medium">{formatNum(result.wb)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="w-7 shrink-0 font-medium text-foreground/90">WC</span>
                <span className="tabular-nums font-medium">{formatNum(result.wc)}</span>
              </div>
            </div>
            {result.showWcExpansion && result.wcExpansion != null && (
              <p className="mt-1 border-t border-white/10 pt-1 text-[10px] text-muted-foreground">
                Wave-C expansion will continue till{" "}
                <span className="tabular-nums font-medium text-foreground">{formatNum(result.wcExpansion)}</span>
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="min-w-0 rounded-md border border-white/10 bg-white/5 p-2">
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Range
        </h4>
        <p className="text-[11px] tabular-nums font-medium">{formatNum(result.range)}</p>
      </section>

      {/* Wave Interpretation — collapsible */}
      <Accordion type="single" collapsible className="w-full rounded-md border border-white/10">
        <AccordionItem value="interpretation" className="border-0">
          <AccordionTrigger className="px-3 py-1.5 text-xs font-medium text-[var(--menu-muted)] hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-white/10">
            Wave Interpretation
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-2 pt-1">
            <WaveInterpretation narrative={narrative} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function ElliottGannCalculator() {
  const [high, setHigh] = useState("");
  const [low, setLow] = useState("");
  const [current, setCurrent] = useState("");
  const [result, setResult] = useState<ElliottGannResult | null>(null);
  const [history, setHistory] = useState<StoredCalculation[]>([]);
  const { calcClickSlot, setCalcClickSlot, lastChartClickPrice, clearLastChartClickPrice } = useChartSettings();

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const [pendingSlot, setPendingSlot] = useState<CalcClickSlot>(null);

  const activateSlot = useCallback((slot: CalcClickSlot) => {
    clearLastChartClickPrice();
    setPendingSlot(slot);
    setCalcClickSlot(slot);
  }, [setCalcClickSlot, clearLastChartClickPrice]);

  // When a new chart click price arrives and we have a pending slot, fill it
  useEffect(() => {
    if (lastChartClickPrice == null || pendingSlot == null) return;
    const val = String(lastChartClickPrice.toFixed(2));
    if (pendingSlot === "high") setHigh(val);
    if (pendingSlot === "low") setLow(val);
    setPendingSlot(null);
  }, [lastChartClickPrice, pendingSlot]);

  // Keep calcClickSlot in sync if user cancels by clicking the active button again
  useEffect(() => {
    if (calcClickSlot === null && pendingSlot !== null) {
      setPendingSlot(null);
    }
  }, [calcClickSlot, pendingSlot]);

  const [accordionValue, setAccordionValue] = useState<string>("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const h = Number(high);
      const l = Number(low);
      const c = Number(current);
      if (Number.isFinite(h) && Number.isFinite(l) && Number.isFinite(c) && h > l) {
        const res = calculateElliottGann(h, l, c);
        setResult(res);
        setAccordionValue("results");
        const entry: StoredCalculation = {
          id: Date.now(),
          high: h,
          low: l,
          current: c,
          result: res,
          timestamp: new Date().toISOString(),
        };
        setHistory(saveToHistory(entry));
      }
    },
    [high, low, current]
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] leading-snug text-[var(--menu-text)] mb-1">
          Click the chart to set high and low, then enter current price and submit.
        </p>
        <form onSubmit={handleSubmit} className="space-y-1.5">
          <div className="flex gap-2">
            {/* High */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="eg-high" className="text-[10px] font-medium text-[var(--menu-text)]">
                  High
                </Label>
                <button
                  type="button"
                  title="Click chart to set high"
                  onClick={() => activateSlot(pendingSlot === "high" ? null : "high")}
                  className={cn(
                    "flex items-center rounded px-0.5 py-0.5 transition-colors",
                    pendingSlot === "high"
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-[var(--menu-text)] hover:text-white"
                  )}
                >
                  <MousePointerClick className="size-2.5" />
                </button>
              </div>
              <input
                id="eg-high"
                type="number"
                step="any"
                placeholder="0.000000"
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                className={cn(
                  "menu-input h-8 w-[90px] tabular-nums text-xs",
                  pendingSlot === "high" && "ring-1 ring-amber-500/60"
                )}
              />
            </div>
            {/* Low */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="eg-low" className="text-[10px] font-medium text-[var(--menu-text)]">
                  Low
                </Label>
                <button
                  type="button"
                  title="Click chart to set low"
                  onClick={() => activateSlot(pendingSlot === "low" ? null : "low")}
                  className={cn(
                    "flex items-center rounded px-0.5 py-0.5 transition-colors",
                    pendingSlot === "low"
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-[var(--menu-text)] hover:text-white"
                  )}
                >
                  <MousePointerClick className="size-2.5" />
                </button>
              </div>
              <input
                id="eg-low"
                type="number"
                step="any"
                placeholder="0.000000"
                value={low}
                onChange={(e) => setLow(e.target.value)}
                className={cn(
                  "menu-input h-8 w-[90px] tabular-nums text-xs",
                  pendingSlot === "low" && "ring-1 ring-amber-500/60"
                )}
              />
            </div>
            {/* Price */}
            <div className="space-y-0.5">
              <Label htmlFor="eg-current" className="text-[10px] font-medium text-[var(--menu-text)]">
                Price
              </Label>
              <input
                id="eg-current"
                type="number"
                step="any"
                placeholder="0.000000"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="menu-input h-8 w-[90px] tabular-nums text-xs"
              />
            </div>
          </div>
          {pendingSlot && (
            <p className="text-[10px] text-amber-400 animate-pulse">
              Click a candle on the chart to set the {pendingSlot}…
            </p>
          )}
          <Button type="submit" size="sm" className="h-8 w-full border border-white/10 bg-white/10 text-xs font-medium text-[var(--menu-text)] hover:bg-white/15 hover:text-white">
            Submit
          </Button>
        </form>

        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full rounded-md border border-white/10"
        >
          {result && (
            <AccordionItem value="results" className="border-white/10">
              <AccordionTrigger className="px-3 py-1.5 text-xs font-medium text-[var(--menu-muted)] hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-white/10">
                Results
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2 pt-0">
                <div className="pt-1">
                  <ResultBlocks result={result} current={Number(current)} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="how-it-works" className="border-white/10">
            <AccordionTrigger className="px-3 py-1.5 text-xs font-medium text-[var(--menu-muted)] hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-white/10">
              How it works
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-2 pt-0">
              <div className="flex flex-col gap-1.5 pt-0.5">
                <p className="text-[11px] font-medium leading-snug text-[var(--menu-text)]">
                  Rule-based Elliott Wave logic with Fibonacci ratios and midpoint symmetry.
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-[10px] text-[var(--menu-text)]">
                  <li>Models impulsive (1–2–3–4–5) and corrective (A–B–C) cycles</li>
                  <li>Builds construction & termination levels from your range</li>
                  <li>Picks dominant cycle from current price</li>
                  <li>Outputs entry, stop, and target</li>
                  <li>Recalibrates when you change the high–low range</li>
                </ul>
                <div className="rounded border border-white/10 bg-white/5">
                  <p className="border-b border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--menu-muted)]">
                    Wave reference
                  </p>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--menu-muted)]">
                        <th className="px-2 py-1">Wave</th>
                        <th className="px-2 py-1">Dir</th>
                        <th className="px-2 py-1">Level</th>
                        <th className="px-2 py-1">Base</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--menu-text)]">
                      {WAVE_REFERENCE.map((row, i) => (
                        <tr key={i} className="border-b border-white/10 last:border-0">
                          <td className="px-2 py-0.5 font-medium tabular-nums">{row.wave}</td>
                          <td className="px-2 py-0.5">{row.direction}</td>
                          <td className="px-2 py-0.5 tabular-nums">{row.level}</td>
                          <td className="px-2 py-0.5 text-[9px]">{row.base}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="previous" className="border-white/10 border-t-0">
            <AccordionTrigger className="px-3 py-1.5 text-xs font-medium text-[var(--menu-muted)] hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-white/10">
              <span className="flex items-center gap-2">
                <History className="size-3.5 text-[var(--menu-muted)]" />
                Previous calculations
                {history.length > 0 && (
                  <span className="text-[10px] font-normal text-[var(--menu-muted)]">
                    ({history.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-2 pt-0">
              {history.length === 0 ? (
                <p className="py-2 text-[11px] text-[var(--menu-muted)]">
                  No previous calculations. Submit a run to store it here.
                </p>
              ) : (
                <Accordion type="multiple" className="mt-1 w-full">
                  {history.map((entry) => (
                    <AccordionItem
                      key={entry.id}
                      value={`entry-${entry.id}`}
                      className="border-white/10"
                    >
                      <AccordionTrigger className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-normal hover:no-underline [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                        <span className="tabular-nums text-[var(--menu-text)]">
                          {formatNum(entry.high)} / {formatNum(entry.low)} → {formatNum(entry.current)}
                        </span>
                        <span className="ml-1 text-[9px] text-[var(--menu-muted)]">
                          {formatHistoryDate(entry.timestamp)}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="rounded-b border border-t-0 border-white/10 bg-white/5 px-2 pb-2 pt-1">
                        <ResultBlocks result={entry.result} current={entry.current} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
