"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChartSettings } from "@/lib/chart-settings-context";
import { IndicatorPanel } from "@/components/indicator-panel";
import { ExportPanel } from "@/components/export-panel";
import { TimeConverter } from "@/components/time-converter";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  Settings2,
  Layers,
  BarChart3,
  Database,
  Clock,
  Square,
  Palette,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";

const MAIN_LINKS = [
  { href: "/smc-viewer", label: "Chart", desc: "SMC animation viewer", icon: LayoutGrid },
  { href: "/smc-viewer?open=all-timeframes", label: "Multi-TF analysis", desc: "Open bottom drawer for all timeframes", icon: Layers },
] as const;

const ENGINE2_LINKS = [
  { href: "/engine2?tab=reference", label: "Reference", desc: "Logic reference", icon: BookOpen },
  { href: "/engine2?tab=diagnostics", label: "Diagnostics", desc: "Run diagnostics", icon: LayoutDashboard },
  { href: "/engine2?tab=evaluate", label: "Evaluate", desc: "Evaluate runs", icon: ClipboardList },
  { href: "/engine2?tab=tune", label: "Tune", desc: "Calibration", icon: Settings2 },
] as const;

type SettingId = "indicators" | "export" | "time" | "square" | "chart";

const SETTING_ITEMS: { id: SettingId; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "indicators", label: "Indicators", desc: "Toggle SMC indicators", icon: BarChart3 },
  { id: "chart", label: "Chart", desc: "Background & appearance", icon: Palette },
  { id: "export", label: "DB Export", desc: "Export frames to database", icon: Database },
  { id: "time", label: "Time conversion", desc: "UTC ↔ Eastern", icon: Clock },
  { id: "square", label: "Square chart", desc: "Frame Y-axis range", icon: Square },
];

interface LeftNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOVER_LEAVE_MS = 120;

export function LeftNavDrawer({ open, onOpenChange }: LeftNavDrawerProps) {
  const [hoveredSetting, setHoveredSetting] = useState<SettingId | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<SettingId, HTMLDivElement | null>>({
    indicators: null,
    export: null,
    time: null,
    square: null,
    chart: null,
  });

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settings = useChartSettings();
  const [chartColorOpen, setChartColorOpen] = useState(false);
  const [hexInput, setHexInput] = useState(settings.chartBackgroundHex);

  useEffect(() => {
    setHexInput(settings.chartBackgroundHex);
  }, [settings.chartBackgroundHex]);

  const clearLeaveTimeout = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (chartColorOpen) clearLeaveTimeout();
  }, [chartColorOpen, clearLeaveTimeout]);

  const scheduleClose = useCallback(() => {
    if (chartColorOpen) return;
    clearLeaveTimeout();
    leaveTimeoutRef.current = setTimeout(() => setHoveredSetting(null), HOVER_LEAVE_MS);
  }, [clearLeaveTimeout, chartColorOpen]);

  const openSetting = useCallback((id: SettingId) => {
    clearLeaveTimeout();
    const el = rowRefs.current[id];
    const container = containerRef.current;
    if (el && container) {
      const r = el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      setFlyoutTop(r.top - c.top);
    }
    setHoveredSetting(id);
  }, [clearLeaveTimeout]);

  const isActive = (href: string) => {
    if (href === "/smc-viewer") return pathname === "/smc-viewer" && searchParams.get("open") !== "all-timeframes";
    if (href === "/smc-viewer?open=all-timeframes" || href.startsWith("/smc-viewer?")) return pathname === "/smc-viewer" && searchParams.get("open") === "all-timeframes";
    if (href.startsWith("/engine2?")) {
      const tab = new URLSearchParams(href.split("?")[1] ?? "").get("tab");
      const currentTab = searchParams.get("tab");
      return pathname === "/engine2" && currentTab === tab;
    }
    return pathname === href || (href !== "/engine2" && pathname.startsWith(href));
  };

  const hasFlyout = hoveredSetting !== null;

  return (
    <DrawerContent
      direction="left"
      showOverlay={false}
      className={cn(
        "app-menu-drawer flex h-full max-h-full flex-col border-0 bg-transparent shadow-none transition-[width] duration-200 ease-out",
        hasFlyout ? "w-[min(720px,92vw)]" : "w-[min(360px,90vw)]"
      )}
    >
      <DrawerTitle className="sr-only">Menu</DrawerTitle>
      <div
        ref={containerRef}
        className="menu-drawer-inner relative flex min-h-0 flex-1"
      >
        {/* Nav column — owns the background; flyout area to its right is transparent */}
        <div className="menu-nav-column relative z-10 flex w-[min(360px,90vw)] shrink-0 flex-col overflow-hidden">
          <div className="relative z-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
            <nav
              className="menu-body px-4 pt-5 pb-[320px]"
              aria-label="Main menu"
              onMouseLeave={scheduleClose}
            >
              <section className="menu-section">
                <h2 className="menu-section-title">Main</h2>
                <ul className="menu-list">
                  {MAIN_LINKS.map(({ href, label, desc, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "menu-link flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                          isActive(href) && "menu-link-active"
                        )}
                      >
                        <span className="menu-link-icon" aria-hidden>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{label}</span>
                          <span className={cn("menu-link-desc text-xs", !isActive(href) && "text-[var(--menu-muted)]")}>
                            {desc}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="menu-section mt-6">
                <h2 className="menu-section-title">Engine 2</h2>
                <ul className="menu-list">
                  {ENGINE2_LINKS.map(({ href, label, desc, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "menu-link flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                          isActive(href) && "menu-link-active"
                        )}
                      >
                        <span className="menu-link-icon" aria-hidden>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{label}</span>
                          <span className={cn("menu-link-desc text-xs", !isActive(href) && "text-[var(--menu-muted)]")}>
                            {desc}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="menu-section mt-6">
                <h2 className="menu-section-title">Settings</h2>
                <ul className="menu-list">
                  {SETTING_ITEMS.map(({ id, label, desc, icon: Icon }) => (
                    <li key={id}>
                      <div
                        ref={(el) => {
                          rowRefs.current[id] = el;
                        }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "menu-link menu-link-setting flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                          hoveredSetting === id && "menu-link-active"
                        )}
                        onMouseEnter={() => openSetting(id)}
                        onMouseLeave={scheduleClose}
                        onFocus={() => openSetting(id)}
                        onBlur={scheduleClose}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openSetting(id);
                          }
                        }}
                      >
                        <span className="menu-link-icon" aria-hidden>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{label}</span>
                          <span className={cn("menu-link-desc text-xs", hoveredSetting !== id && "text-[var(--menu-muted)]")}>
                            {desc}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </nav>
            </ScrollArea>
          </div>

          {/* Bottom area: dotted glow only */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[520px] overflow-hidden" aria-hidden>
            <DottedGlowBackground
              className="menu-glow-fade"
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

        {/* Flyout: transparent, positions only at hovered row — no background above/below */}
        <div
          className={cn(
            "menu-flyout absolute left-[min(360px,90vw)] z-10 w-[360px] border-l border-[var(--menu-border)]/50 bg-transparent transition-[opacity] duration-200 ease-out",
            hasFlyout ? "overflow-y-auto opacity-100" : "pointer-events-none opacity-0"
          )}
          style={{
            top: flyoutTop,
            maxHeight: hasFlyout ? `min(70vh, calc(100% - ${flyoutTop}px))` : "0px",
          }}
          onMouseEnter={clearLeaveTimeout}
          onMouseLeave={scheduleClose}
        >
          {hasFlyout && (
            <div className="menu-flyout-inner px-4 pb-4 pt-1">
                {hoveredSetting === "indicators" && (
                  <IndicatorPanel
                    visibility={settings.indicatorVisibility}
                    onToggle={settings.toggleIndicator}
                    onCandlesOnly={settings.setCandlesOnly}
                  />
                )}
                {hoveredSetting === "chart" && (
                  <>
                    <h3 className="menu-settings-title mb-3">Chart background</h3>
                    <p className="menu-settings-desc mb-3">
                      Pick a color for the main chart (panel 1). The picker stays open so you can use the eyedropper or type a hex value.
                    </p>
                    <Popover open={chartColorOpen} onOpenChange={setChartColorOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="menu-input flex h-9 w-full max-w-[12rem] cursor-pointer items-center gap-2 rounded-md border border-[var(--menu-border)] bg-[var(--menu-surface)] px-3 text-left transition-colors hover:bg-[var(--menu-surface-hover)]"
                          aria-label="Chart background color"
                        >
                          <span
                            className="h-5 w-8 shrink-0 rounded border border-[var(--menu-border)]"
                            style={{ backgroundColor: settings.chartBackgroundHex }}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate font-mono text-xs text-[var(--menu-text)]">
                            {settings.chartBackgroundHex}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto min-w-[16rem] border-[var(--menu-border)] bg-[var(--menu-surface)] p-3"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="space-y-3">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-[var(--menu-text)]">Color</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={settings.chartBackgroundHex}
                                onChange={(e) => {
                                  settings.setChartBackground("custom");
                                  settings.setChartBackgroundHex(e.target.value);
                                }}
                                className="h-9 w-14 cursor-pointer rounded border border-[var(--menu-border)] bg-transparent p-0.5"
                                aria-label="Pick color"
                              />
                              <input
                                type="text"
                                value={hexInput}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setHexInput(v);
                                  const trimmed = v.trim();
                                  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed) || /^[0-9A-Fa-f]{6}$/.test(trimmed)) {
                                    settings.setChartBackground("custom");
                                    settings.setChartBackgroundHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
                                  }
                                }}
                                placeholder="#282828"
                                className="menu-input h-9 flex-1 font-mono text-sm"
                                aria-label="Hex value"
                              />
                            </div>
                          </label>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
                {hoveredSetting === "export" && (
                  <>
                    <h3 className="menu-settings-title mb-3">DB Export</h3>
                    <ExportPanel
                      symbol={settings.chartMeta?.symbol ?? ""}
                      currentTimeframe={settings.chartMeta?.timeframe ?? "23"}
                      onExportSuccess={settings.onChartRefresh ?? undefined}
                    />
                  </>
                )}
                {hoveredSetting === "time" && (
                  <>
                    <h3 className="menu-settings-title mb-3">Time conversion</h3>
                    <TimeConverter />
                  </>
                )}
                {hoveredSetting === "square" && (
                  <>
                    <h3 className="menu-settings-title mb-3">Square chart</h3>
                    <p className="menu-settings-desc mb-3">
                      Set Y-axis to a swing low and swing high so the chart frames that range.
                    </p>
                    <div className="menu-form-grid">
                      <div className="space-y-1.5">
                        <Label htmlFor="menu-square-low" className="menu-label">Swing low</Label>
                        <input
                          id="menu-square-low"
                          type="number"
                          step="any"
                          placeholder="e.g. 3200"
                          value={settings.swingLowInput}
                          onChange={(e) => settings.setSwingLowInput(e.target.value)}
                          className="menu-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="menu-square-high" className="menu-label">Swing high</Label>
                        <input
                          id="menu-square-high"
                          type="number"
                          step="any"
                          placeholder="e.g. 3400"
                          value={settings.swingHighInput}
                          onChange={(e) => settings.setSwingHighInput(e.target.value)}
                          className="menu-input"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="menu-btn-primary" onClick={settings.handleSquareChart}>
                        Square chart
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="menu-btn-secondary" onClick={settings.handleClearSquare}>
                        Clear
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Checkbox
                        id="menu-square-log-scale"
                        checked={settings.logScale}
                        onCheckedChange={(c) => settings.setLogScale(c === true)}
                        className="menu-checkbox"
                      />
                      <Label htmlFor="menu-square-log-scale" className="menu-checkbox-label">
                        Log scale (Y-axis)
                      </Label>
                    </div>
                  </>
                )}
              </div>
          )}
        </div>
      </div>
    </DrawerContent>
  );
}
