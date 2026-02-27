"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ExportHud } from "@/components/export-hud";

const TIMEFRAME_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "23", label: "23m" },
  { value: "90", label: "90m" },
  { value: "360", label: "360m" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "all", label: "All TF" },
] as const;

export interface ExportPanelProps {
  symbol: string;
  currentTimeframe: string;
  onExportSuccess?: () => void;
}

export function ExportPanel({
  symbol,
  currentTimeframe,
  onExportSuccess,
}: ExportPanelProps) {
  const [last, setLast] = useState(1000);
  const [windowSize, setWindowSize] = useState(100);
  const [timeframe, setTimeframe] = useState<string>("current");
  const [hudActive, setHudActive] = useState(false);
  const [lastResult, setLastResult] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const handleRun = () => {
    setLastResult(null);
    setHudActive(true);
  };

  const handleHudComplete = useCallback(
    (result: { ok: boolean; message: string }) => {
      setLastResult({
        type: result.ok ? "ok" : "error",
        text: result.message,
      });
      if (result.ok) onExportSuccess?.();
      setTimeout(() => setHudActive(false), 4000);
    },
    [onExportSuccess],
  );

  const resolvedTf = timeframe === "current" ? currentTimeframe : timeframe;

  return (
    <div className="export-module">
      {/* Row 1: Bars + Window side by side */}
      <div className="export-module-params-row">
        <CompactNumericField
          label="Bars"
          value={last}
          min={1000}
          max={10000}
          step={1000}
          disabled={hudActive}
          onChange={(v) => setLast(Math.min(10000, Math.max(1000, v)))}
        />
        <CompactNumericField
          label="Window"
          value={windowSize}
          min={50}
          max={500}
          step={10}
          disabled={hudActive}
          onChange={(v) => setWindowSize(Math.min(500, Math.max(50, v)))}
        />
      </div>

      {/* Row 2: Horizontal timeframe selector */}
      <TimeframeSelector
        value={timeframe}
        onChange={setTimeframe}
        disabled={hudActive}
      />

      {/* Row 3: Engage button */}
      {!hudActive && (
        <button
          type="button"
          onClick={handleRun}
          className="export-module-engage"
        >
          Engage
        </button>
      )}

      {/* HUD — replaces engage when active */}
      <ExportHud
        active={hudActive}
        symbol={symbol}
        timeframe={resolvedTf}
        last={last}
        windowSize={windowSize}
        allTimeframes={timeframe === "all"}
        onComplete={handleHudComplete}
      />

      {/* Result after HUD closes */}
      {!hudActive && lastResult && (
        <div
          className={`export-module-result ${lastResult.type === "ok" ? "export-module-result-ok" : "export-module-result-error"}`}
        >
          {lastResult.text}
        </div>
      )}
    </div>
  );
}

/* ─── Compact numeric stepper ─────────────────────────────────────────── */

function CompactNumericField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <div className="export-numeric">
      <span className="export-numeric-label">{label}</span>
      <div className="export-numeric-controls">
        <button
          type="button"
          className="export-numeric-btn"
          onClick={decrement}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <span className="export-numeric-value">{value}</span>
        <button
          type="button"
          className="export-numeric-btn"
          onClick={increment}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ─── Horizontal timeframe selector ──────────────────────────────────── */

function TimeframeSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>(
      `[data-tf-value="${value}"]`,
    );
    if (!activeEl) return;
    const listRect = list.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();
    setHighlightStyle({
      left: aRect.left - listRect.left,
      width: aRect.width,
      opacity: 1,
    });
  }, [value]);

  return (
    <div className="export-tf-selector">
      <span className="export-tf-title">TF</span>
      <div className="export-tf-list" ref={listRef}>
        <div className="export-tf-highlight" style={highlightStyle} />
        {TIMEFRAME_OPTIONS.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              data-tf-value={opt.value}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`export-tf-item ${isActive ? "export-tf-item-active" : ""}`}
            >
              <span className="export-tf-item-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
