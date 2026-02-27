"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { X, Heart, Circle, ChevronDown, ChevronRight } from "lucide-react";

export type GratitudeEntry = {
  id: string;
  body: string;
  created_at: string;
};

function formatDateKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface GratitudeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional trigger slot; if not provided, caller renders trigger and controls open state. */
  trigger?: React.ReactNode;
}

export function GratitudeDrawer({ open, onOpenChange, trigger }: GratitudeDrawerProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [streamView, setStreamView] = useState<"chain" | "seed">("chain");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toggleDate = useCallback((dateLabel: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateLabel)) next.delete(dateLabel);
      else next.add(dateLabel);
      return next;
    });
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gratitude");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchEntries();
      setInput("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, fetchEntries]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setEntries((prev) => [data, ...prev]);
      setLastAddedId(data.id);
      setInput("");
      inputRef.current?.focus();
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setLastAddedId(null), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [input, saving]);

  const byDate = entries.reduce<Record<string, GratitudeEntry[]>>((acc, e) => {
    const key = formatDateKey(e.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <>
      {trigger}
      <Drawer
        direction="right"
        open={open}
        onOpenChange={onOpenChange}
      >
        <DrawerContent
          direction="right"
          showOverlay
          className="gratitude-drawer gratitude-drawer-bg inset-y-0 left-auto right-0 top-0 h-full max-h-full w-[min(380px,92vw)] rounded-l-xl shadow-[-8px_0_32px_0_rgba(0,0,0,0.4)]"
        >
          <DrawerTitle className="sr-only">Gratitude</DrawerTitle>
          <div className="relative flex h-full flex-col overflow-hidden">
            <div className="gratitude-header flex shrink-0 items-center justify-between border-b border-[var(--gratitude-border)] px-3 py-2">
              <span className="gratitude-title text-[10px] font-semibold uppercase tracking-widest text-[var(--gratitude-muted)]">
                Gratitude
              </span>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[var(--gratitude-muted)] hover:bg-[var(--gratitude-node-bg)] hover:text-[var(--gratitude-node)]"
                  aria-label="Close"
                >
                  <X className="size-3" />
                </Button>
              </DrawerClose>
            </div>

            <div className="gratitude-add flex shrink-0 border-b border-[var(--gratitude-border)] p-3">
              <div className="flex w-full gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="One thing you’re grateful for…"
                  maxLength={500}
                  rows={2}
                  className="gratitude-input min-h-[52px] min-w-0 flex-1 resize-none rounded-lg border border-[var(--gratitude-border)] bg-[var(--gratitude-input-bg)] px-3 py-2.5 text-[13px] leading-snug text-[var(--gratitude-text)] placeholder:text-[var(--gratitude-muted)] focus:border-[var(--gratitude-node)] focus:outline-none focus:ring-2 focus:ring-[var(--gratitude-node)]/30"
                />
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!input.trim() || saving}
                  className="gratitude-submit h-[52px] w-14 shrink-0 rounded-lg bg-[var(--gratitude-node)] px-3 text-[12px] font-medium text-[var(--gratitude-bg)] hover:opacity-90"
                >
                  {saving ? "…" : "Add"}
                </Button>
              </div>
              {error && (
                <p className="mt-1.5 text-[11px] text-[var(--gratitude-error)]">
                  {error}
                </p>
              )}
            </div>

            {entries.length > 0 && (
              <div className="gratitude-stream-wrap shrink-0 border-b border-[var(--gratitude-border)] px-3 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--gratitude-muted)]">
                    Your stream
                  </p>
                  <button
                    type="button"
                    onClick={() => setStreamView((v) => (v === "chain" ? "seed" : "chain"))}
                    className="gratitude-view-toggle rounded-full p-1 transition-colors hover:bg-[var(--gratitude-node-bg)]"
                    title={streamView === "chain" ? "Show as seed of life" : "Show as chain"}
                    aria-label={streamView === "chain" ? "Show seed of life view" : "Show chain view"}
                  >
                    <Circle className="size-3.5 text-[var(--gratitude-node)]" aria-hidden />
                  </button>
                </div>
                <div className="ml-5">
                  {streamView === "chain" ? (
                    <GratitudeStream
                      entries={entries}
                      lastAddedId={lastAddedId}
                      selectedId={selectedStreamId}
                      onSelect={(id) => {
                        setSelectedStreamId(id);
                        listRef.current?.querySelector(`[data-gratitude-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                    />
                  ) : (
                    <GratitudeSeedOfLife
                      entries={entries}
                      lastAddedId={lastAddedId}
                      selectedId={selectedStreamId}
                      onSelect={(id) => {
                        setSelectedStreamId(id);
                        listRef.current?.querySelector(`[data-gratitude-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={listRef}
                className="gratitude-list flex-1 overflow-y-auto overflow-x-hidden px-4 py-2"
              >
                {loading ? (
                <p className="py-4 text-center text-[10px] text-[var(--gratitude-muted)]">
                  Loading…
                </p>
              ) : entries.length === 0 ? (
                <p className="py-6 text-center text-[10px] text-[var(--gratitude-muted)]">
                  Tap the ribbon anytime to add a moment of gratitude.
                </p>
              ) : (
                <ul className="gratitude-timeline space-y-5">
                  {Object.entries(byDate).map(([dateLabel, items]) => {
                    const isCollapsed = collapsedDates.has(dateLabel);
                    return (
                      <li key={dateLabel}>
                        <button
                          type="button"
                          onClick={() => toggleDate(dateLabel)}
                          className="gratitude-date mb-2 flex w-full items-center gap-2 px-0.5 text-left hover:opacity-90"
                          aria-expanded={!isCollapsed}
                          aria-label={
                            isCollapsed
                              ? `Expand ${dateLabel} (${items.length})`
                              : `Collapse ${dateLabel}`
                          }
                        >
                          <span className="h-px flex-1 bg-[var(--gratitude-border)]" />
                          <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest text-[var(--gratitude-muted)]">
                            {isCollapsed ? (
                              <ChevronRight className="size-3 shrink-0" aria-hidden />
                            ) : (
                              <ChevronDown className="size-3 shrink-0" aria-hidden />
                            )}
                            {dateLabel}
                            <span className="text-[var(--gratitude-muted)]/80">
                              ({items.length})
                            </span>
                          </span>
                          <span className="h-px flex-1 bg-[var(--gratitude-border)]" />
                        </button>
                        {!isCollapsed && (
                          <ul className="relative border-l-2 border-[var(--gratitude-node)]/25 pl-0">
                            {items.map((entry, i) => (
                              <GratitudeNode
                                key={entry.id}
                                entry={entry}
                                isLast={i === items.length - 1}
                                isSelected={selectedStreamId === entry.id}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              </div>
              {/* Bottom area: dotted glow (same treatment as main nav drawer) */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[520px] overflow-hidden"
                aria-hidden
              >
                <DottedGlowBackground
                  className="gratitude-glow-fade"
                  opacity={0.8}
                  gap={5}
                  radius={1.0}
                  colorLightVar="--color-neutral-100"
                  glowColorLightVar="--color-neutral-700"
                  colorDarkVar="--color-neutral-600"
                  glowColorDarkVar="--color-sky-900"
                  backgroundOpacity={0}
                  speedMin={0.05}
                  speedMax={0.3}
                  speedScale={0.25}
                />
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Radius for each circle; center-to-center = radius gives vesica piscis overlap. */
const VESICA_RADIUS_PX = 24;
/** Chain view: wrap to next row after this many circles; rows stagger so circles overlay (hex-style). */
const CHAIN_CIRCLES_PER_ROW = 9;
/** Left offset so the first circle isn’t flush to the edge. */
const CHAIN_LEFT_OFFSET_PX = 12;

const SQRT3 = Math.sqrt(3);

/**
 * Flower of Life / Seed of Life – polar construction (matches FlowerOfLife example).
 * Order: 1 center, 6 inner ring (seed of life), 12 outer ring (6 corner at 2r + 6 mid at √3·r).
 * Coordinates relative to origin; use same angle convention: x = r*cos(θ), y = r*sin(θ).
 */
function getFlowerOfLifeCenters(count: number, r: number): { x: number; y: number }[] {
  const centers: { x: number; y: number }[] = [];
  if (count <= 0) return centers;

  // 1. Central circle
  centers.push({ x: 0, y: 0 });
  if (count <= 1) return centers;

  // 2. Inner ring (Seed of Life – 6 circles at radius r)
  for (let i = 0; i < 6; i++) {
    if (centers.length >= count) break;
    const angle = (i * Math.PI) / 3;
    centers.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    });
  }
  if (centers.length >= count) return centers;

  // 3. Outer ring (12 circles: 6 corner at 2r, 6 mid at √3·r)
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    if (centers.length < count) {
      centers.push({ x: (2 * r) * Math.cos(angle), y: (2 * r) * Math.sin(angle) });
    }
    if (centers.length < count) {
      const midAngle = angle + Math.PI / 6;
      centers.push({
        x: SQRT3 * r * Math.cos(midAngle),
        y: SQRT3 * r * Math.sin(midAngle),
      });
    }
  }
  if (centers.length >= count) return centers;

  // 4. Extra rings (3, 4, …): same 12-circle pattern as outer ring – 6 corner + 6 mid
  let ringIndex = 3;
  while (centers.length < count) {
    const cornerRadius = ringIndex * r;
    const midRadius = (ringIndex - 1) * SQRT3 * r;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      if (centers.length < count) {
        centers.push({ x: cornerRadius * Math.cos(angle), y: cornerRadius * Math.sin(angle) });
      }
      if (centers.length < count) {
        const midAngle = angle + Math.PI / 6;
        centers.push({ x: midRadius * Math.cos(midAngle), y: midRadius * Math.sin(midAngle) });
      }
    }
    ringIndex += 1;
  }

  return centers.slice(0, count);
}

function getSeedOfLifePosition(index: number, centers: { x: number; y: number }[]): { x: number; y: number } {
  return centers[index] ?? { x: 0, y: 0 };
}

function GratitudeSeedOfLife({
  entries,
  lastAddedId,
  selectedId,
  onSelect,
}: {
  entries: GratitudeEntry[];
  lastAddedId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const R = VESICA_RADIUS_PX;
  const centers = getFlowerOfLifeCenters(entries.length, R);
  const maxRadius = centers.length > 0
    ? Math.max(...centers.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)))
    : 0;
  const padding = R + 8;
  const size = Math.ceil(2 * (maxRadius + R + padding));
  const center = size / 2;

  return (
    <div
      className="gratitude-seed-wrap gratitude-stream-vesica relative overflow-hidden"
      style={{ width: size, height: size, margin: "0 auto" }}
    >
      {entries.map((entry, index) => {
        const isNew = entry.id === lastAddedId;
        const isSelected = entry.id === selectedId;
        const positionIndex = entries.length - 1 - index;
        const pos = getSeedOfLifePosition(positionIndex, centers);
        const left = center + pos.x - R;
        const top = center + pos.y - R;
        const zIndex = entries.length - index;
        const useAltColor = positionIndex % 2 === 1;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={`gratitude-stream-node gratitude-stream-node-vesica absolute flex items-center justify-center ${useAltColor ? "gratitude-stream-node-color-b" : ""} ${isNew ? "gratitude-stream-node-ripple" : ""} ${isSelected ? "gratitude-stream-node-selected" : ""}`}
            style={{
              left,
              top,
              width: R * 2,
              height: R * 2,
              zIndex,
            }}
            aria-label={entry.body}
            title={entry.body}
          >
            <span className="gratitude-stream-node-dot" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function GratitudeStream({
  entries,
  lastAddedId,
  selectedId,
  onSelect,
}: {
  entries: GratitudeEntry[];
  lastAddedId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lastAddedId && scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
        top: scrollRef.current.scrollHeight - scrollRef.current.clientHeight,
        behavior: "smooth",
      });
    }
  }, [lastAddedId]);

  if (entries.length === 0) return null;

  const R = VESICA_RADIUS_PX;
  const chainOrder = [...entries].reverse();
  const rowCount = Math.ceil(chainOrder.length / CHAIN_CIRCLES_PER_ROW);
  const rowHeight = (R * SQRT3) / 2;
  const width = CHAIN_LEFT_OFFSET_PX + (CHAIN_CIRCLES_PER_ROW - 1) * R + R * 2;
  const height = Math.max(R * 2, (rowCount - 1) * rowHeight + R * 2);

  return (
    <div
      ref={scrollRef}
      className="gratitude-stream gratitude-stream-vesica no-scrollbar overflow-x-auto overflow-y-auto pb-2 pt-2"
      style={{ minHeight: 96, maxHeight: 220 }}
    >
      <div className="relative" style={{ width, height }}>
        {chainOrder.map((entry, index) => {
          const isNew = entry.id === lastAddedId;
          const isSelected = entry.id === selectedId;
          const row = Math.floor(index / CHAIN_CIRCLES_PER_ROW);
          const col = index % CHAIN_CIRCLES_PER_ROW;
          const leftPx = CHAIN_LEFT_OFFSET_PX + (row % 2 === 0 ? col * R : R / 2 + col * R);
          const topPx = row * rowHeight;
          const zIndex = index + 1;
          const useAltColor = index % 2 === 1;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className={`gratitude-stream-node gratitude-stream-node-vesica absolute flex items-center justify-center ${useAltColor ? "gratitude-stream-node-color-b" : ""} ${isNew ? "gratitude-stream-node-ripple" : ""} ${isSelected ? "gratitude-stream-node-selected" : ""}`}
              style={{
                left: leftPx,
                top: topPx,
                width: R * 2,
                height: R * 2,
                zIndex,
              }}
              aria-label={entry.body}
              title={entry.body}
            >
              <span className="gratitude-stream-node-dot" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GratitudeNode({
  entry,
  isLast,
  isSelected,
}: {
  entry: GratitudeEntry;
  isLast: boolean;
  isSelected?: boolean;
}) {
  return (
    <li
      data-gratitude-id={entry.id}
      className={`gratitude-timeline-item relative flex pl-4 ${isSelected ? "gratitude-timeline-item-selected" : ""}`}
      style={{ marginBottom: isLast ? 0 : "0.75rem" }}
    >
      <span className="gratitude-node-dot absolute left-0 top-0.5 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--gratitude-node)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-snug text-[var(--gratitude-text)]">
          {entry.body}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--gratitude-muted)]">
          {formatTime(entry.created_at)}
        </p>
      </div>
    </li>
  );
}

export function GratitudeRibbon({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={() => onOpenChange(!open)}
      title="Gratitude"
      aria-label="Open gratitude"
      className="gratitude-ribbon nav-tab-trigger nav-tab-trigger-right-full flex h-10 w-10 shrink-0 items-center justify-center rounded-l-md rounded-r-none border border-r-0 p-0"
    >
      <Heart className="size-4 shrink-0" aria-hidden />
    </Button>
  );
}
