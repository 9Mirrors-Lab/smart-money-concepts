"use client";

import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import type { IndicatorId } from "@/lib/smc-types";
import { INDICATOR_IDS, INDICATOR_LABELS, SESSION_INDICATOR_IDS } from "@/lib/smc-types";
import { cn } from "@/lib/utils";

const SESSION_SET = new Set<IndicatorId>(SESSION_INDICATOR_IDS as unknown as IndicatorId[]);

const TOOLBAR_INDICATORS: IndicatorId[] = INDICATOR_IDS.filter(
  (id) => !SESSION_SET.has(id)
);

const OPACITY_DEFAULT: Partial<Record<IndicatorId, number>> = {
  fvg:            0.2,
  ob:             0.2,
  sessionsAsia:   0.15,
  sessionsLondon: 0.2,
  sessionsNYAM:   0.15,
  sessionsNYPM:   0.15,
};

interface FloatingIndicatorToolbarProps {
  visibility: Record<IndicatorId, boolean>;
  onToggle: (id: IndicatorId) => void;
  onCandlesOnly?: () => void;
  onPin: () => void;
  opacity?: Partial<Record<IndicatorId, number>>;
  onOpacityChange?: (id: IndicatorId, value: number) => void;
}

const STORAGE_KEY = "ind-toolbar-pos";

function loadPos(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function DragHandle() {
  const cols = [0, 1, 2];
  const rows = [0, 1];
  const spacing = 7;
  const r = 2.2;
  const ox = 4;
  const oy = 5;
  const w = ox * 2 + spacing * 2 + r * 2;
  const h = oy * 2 + spacing * 1 + r * 2;
  return (
    <svg className="floating-ind-drag-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <defs>
        <radialGradient id="dot-raised" cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor="oklch(0.72 0 0)" stopOpacity="1" />
          <stop offset="55%" stopColor="oklch(0.50 0 0)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.28 0 0)" stopOpacity="0.85" />
        </radialGradient>
        <filter id="dot-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.7" floodColor="oklch(0 0 0)" floodOpacity="0.75" />
        </filter>
      </defs>
      {rows.map((row) => cols.map((col) => {
        const cx = ox + r + col * spacing;
        const cy = oy + r + row * spacing;
        return (
          <g key={`${col}-${row}`}>
            <circle cx={cx} cy={cy + 1} r={r + 0.5} fill="oklch(0 0 0 / 0.5)" />
            <circle cx={cx} cy={cy} r={r} fill="url(#dot-raised)" filter="url(#dot-shadow)" />
            <circle cx={cx - 0.7} cy={cy - 0.8} r={0.7} fill="white" opacity="0.28" />
          </g>
        );
      }))}
    </svg>
  );
}

/** A pill that shows a vertical opacity popover on hover (for supported indicators) */
function IndicatorPill({
  id,
  on,
  onToggle,
  opacity,
  onOpacityChange,
}: {
  id: IndicatorId;
  on: boolean;
  onToggle: () => void;
  opacity?: Partial<Record<IndicatorId, number>>;
  onOpacityChange?: (id: IndicatorId, value: number) => void;
}) {
  const hasOpacity = onOpacityChange && id in OPACITY_DEFAULT;
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  };
  const cancelHide = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const value = opacity?.[id] ?? OPACITY_DEFAULT[id] ?? 0.2;
  const pct = Math.round(value * 100);

  return (
    <div
      className="floating-ind-pill-wrap"
      onMouseEnter={() => { cancelHide(); if (hasOpacity) setHovered(true); }}
      onMouseLeave={scheduleHide}
    >
      {/* Opacity popover — appears above the pill */}
      {hasOpacity && hovered && (
        <div
          className="floating-ind-popover"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <span className="floating-ind-popover-pct">{pct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => onOpacityChange!(id, Number(e.target.value) / 100)}
            className="floating-ind-popover-slider"
            aria-label={`${INDICATOR_LABELS[id]} opacity`}
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <span className="floating-ind-popover-label">Opacity</span>
        </div>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          "floating-ind-pill",
          on ? "floating-ind-pill-on" : "floating-ind-pill-off",
          hasOpacity && "floating-ind-pill-has-opacity"
        )}
      >
        <span className={cn("floating-ind-dot", on ? "floating-ind-dot-on" : "floating-ind-dot-off")} aria-hidden />
        <span className="floating-ind-label">{INDICATOR_LABELS[id]}</span>
      </button>
    </div>
  );
}

export function FloatingIndicatorToolbar({
  visibility,
  onToggle,
  onCandlesOnly,
  onPin,
  opacity,
  onOpacityChange,
}: FloatingIndicatorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = loadPos();
    const el = toolbarRef.current;
    const w = el ? el.offsetWidth : 700;
    const initial = saved ?? {
      x: Math.max(0, (window.innerWidth - w) / 2),
      y: window.innerHeight - 120,
    };
    posRef.current = initial;
    setPos(initial);
    setInitialized(true);
  }, []);

  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = posRef.current.x;
    const originY = posRef.current.y;
    const onMove = (ev: PointerEvent) => {
      const el = toolbarRef.current;
      const w = el ? el.offsetWidth : 0;
      const h = el ? el.offsetHeight : 0;
      const x = Math.max(0, Math.min(window.innerWidth - w, originX + ev.clientX - startX));
      const y = Math.max(0, Math.min(window.innerHeight - h, originY + ev.clientY - startY));
      posRef.current = { x, y };
      setPos({ x, y });
    };
    const onUp = () => {
      savePos(posRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!initialized) return null;

  return (
    <div
      ref={toolbarRef}
      className="floating-ind-toolbar-positioner"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="floating-ind-toolbar">
        {/* Drag handle */}
        <div
          className="floating-ind-handle"
          onPointerDown={handleGripPointerDown}
          title="Drag to move"
          aria-label="Drag handle"
        >
          <DragHandle />
        </div>

        <div className="floating-ind-divider" aria-hidden />

        {/* Pills */}
        <div className="floating-ind-pills">
          {TOOLBAR_INDICATORS.map((id) => (
            <IndicatorPill
              key={id}
              id={id}
              on={visibility[id]}
              onToggle={() => onToggle(id)}
              opacity={opacity}
              onOpacityChange={onOpacityChange}
            />
          ))}
          {onCandlesOnly && (
            <button
              type="button"
              onClick={onCandlesOnly}
              className="floating-ind-pill floating-ind-pill-off floating-ind-pill-muted"
            >
              <span className="floating-ind-dot floating-ind-dot-off opacity-0" aria-hidden />
              <span className="floating-ind-label text-[var(--menu-muted)]">No Ind</span>
            </button>
          )}
        </div>

        {/* Pin button */}
        <button
          type="button"
          onClick={onPin}
          className="floating-ind-pin-btn"
          title="Pin back to menu"
          aria-label="Pin indicators back to menu"
        >
          <Pin className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
