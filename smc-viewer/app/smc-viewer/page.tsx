"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SMCChart } from "@/components/chart";
import { JumpToEvent } from "@/components/jump-to-event";
import { PlaybackControls } from "@/components/playback-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlignmentPanel } from "@/components/alignment-panel";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import {
  AggregateDiagnosticsPanel,
  type AggregateDiagnosticsPanelHandle,
} from "@/components/aggregate-diagnostics-panel";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatTimestampEST } from "@/lib/format-time";
import { frameToPlotly, type WaveStateRow } from "@/lib/frame-to-plotly";
import { getActiveOverridesQueryFragment, getVersionStore } from "@/lib/engine2-version-store";
import type { MarketInterpretation } from "@/lib/interpretation-engine";
import type { SMCDataset, SMCFrame } from "@/lib/smc-types";
import { useSMCPlayer } from "@/lib/use-smc-player";
import { useChartSettings, useChartSettingsRegistration } from "@/lib/chart-settings-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns2, Square, SquareX, X, Download, BarChart2, LayoutGrid, ChevronDown, ChevronUp, Wand } from "lucide-react";

interface DatasetOption {
  id: string;
  path: string;
  label: string;
  /** When set, fetch from this URL instead of /data/{path} (e.g. live from smc_results). */
  url?: string;
}

const DEFAULT_DATASETS: DatasetOption[] = [
  { id: "default", path: "smc_frames.json", label: "Chart" },
];

export default function SMCViewerPage() {
  const [datasets, setDatasets] = useState<DatasetOption[]>(DEFAULT_DATASETS);
  const [selectedId, setSelectedId] = useState<string>("default");
  const [dataset, setDataset] = useState<SMCDataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/datasets.json")
      .then((r) => (r.ok ? r.json() : DEFAULT_DATASETS))
      .then((list: DatasetOption[]) => {
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setDatasets(list);
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedId("default");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const option = datasets.find((d) => d.id === selectedId);
    if (!option) return;
    let cancelled = false;
    setLoadError(null);
    setDataset(null);
    const dataUrl = option.url ?? `/data/${option.path}`;
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data: SMCDataset) => {
        if (!cancelled) {
          setDataset(data);
          setLoadError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load data");
      });
    return () => {
      cancelled = true;
    };
  }, [datasets, selectedId, refreshKey]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-destructive">{loadError}</p>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Chart" />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <SMCViewer
      key={selectedId}
      frames={dataset.frames}
      meta={dataset.meta}
      datasets={datasets}
      selectedDatasetId={selectedId}
      onDatasetChange={setSelectedId}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />
  );
}

interface SMCViewerProps {
  frames: SMCFrame[];
  meta: SMCDataset["meta"];
  datasets: DatasetOption[];
  selectedDatasetId: string;
  onDatasetChange: (id: string) => void;
  onRefresh?: () => void;
}

function SMCViewer({
  frames,
  meta,
  datasets,
  selectedDatasetId,
  onDatasetChange,
  onRefresh,
}: SMCViewerProps) {
  const [waveState, setWaveState] = useState<WaveStateRow[] | null>(null);
  const [interpretation, setInterpretation] = useState<MarketInterpretation | null>(null);
  const [interpretationLoading, setInterpretationLoading] = useState(false);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);
  const [multiTfView, setMultiTfView] = useState(false);
  type TrayStage = "closed" | "cards" | "cardsAndDiagnostics";
  const [trayStage, setTrayStage] = useState<TrayStage>("closed");
  const [playbackExpanded, setPlaybackExpanded] = useState(false);
  const [topBarOpen, setTopBarOpen] = useState(false);
  const searchParams = useSearchParams();
  const [aggregateDrawerOpen, setAggregateDrawerOpen] = useState(false);
  const aggregatePanelRef = useRef<AggregateDiagnosticsPanelHandle>(null);

  useEffect(() => {
    if (searchParams.get("open") === "all-timeframes") {
      setAggregateDrawerOpen(true);
      window.history.replaceState(null, "", "/smc-viewer");
    }
  }, [searchParams]);
  const [aggregatePanelState, setAggregatePanelState] = useState({
    loading: false,
    hasResults: false,
    copyStatus: "idle" as "idle" | "copied",
  });
  const [multiTfData, setMultiTfData] = useState<{
    interpretations: (MarketInterpretation & { timeframe: string; timestamp?: string })[];
    globalBiasBanner?: string;
  } | null>(null);
  const [multiTfLoading, setMultiTfLoading] = useState(false);

  /** Sync Engine 2 active version so interpretation refetches when it changes (e.g. after Tune). */
  const [engine2VersionKey, setEngine2VersionKey] = useState<string>("default");
  useEffect(() => {
    const sync = () => {
      const store = getVersionStore();
      setEngine2VersionKey(store.activeVersionId ?? "default");
    };
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const {
    currentFrame,
    current,
    totalFrames,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    isReversed,
    setIsReversed,
    indicatorVisibility,
    toggleIndicator,
    setCandlesOnly,
    goToFrame,
    stepForward,
    stepBack,
  } = useSMCPlayer({ frames, defaultSpeed: 1 });

  const chartSettingsReg = useChartSettingsRegistration();
  const chartSettings = useChartSettings();
  useEffect(() => {
    chartSettingsReg.registerChart({
      indicatorVisibility,
      toggleIndicator,
      setCandlesOnly,
      chartMeta: { symbol: meta.symbol ?? "", timeframe: meta.timeframe ?? "" },
      onChartRefresh: onRefresh ?? (() => {}),
    });
    return () => chartSettingsReg.unregisterChart();
    // Intentionally omit chartSettingsReg to avoid loop: registerChart updates context, which would retrigger this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.symbol, meta.timeframe, onRefresh]);
  useEffect(() => {
    chartSettingsReg.syncIndicatorVisibility(indicatorVisibility);
    // Omit chartSettingsReg so sync does not retrigger when context updates after setState.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorVisibility]);

  useEffect(() => {
    if (!frames.length || !meta.symbol || !meta.timeframe) {
      setWaveState(null);
      return;
    }
    const first = frames[0];
    const last = frames[frames.length - 1];
    const from = first?.ohlc?.x?.[0];
    const to = last?.ohlc?.x?.[last.ohlc.x.length - 1];
    if (!from || !to) {
      setWaveState(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      symbol: meta.symbol,
      timeframe: meta.timeframe,
      from,
      to,
    });
    fetch(`/api/wave-engine/state?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body: { data?: WaveStateRow[] }) => {
        if (!cancelled && Array.isArray(body.data)) setWaveState(body.data);
      })
      .catch(() => {
        if (!cancelled) setWaveState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [frames, meta.symbol, meta.timeframe]);

  useEffect(() => {
    if (!meta.symbol || multiTfView) {
      setInterpretation(null);
      setInterpretationError(null);
      return;
    }
    if (!meta.timeframe || !current?.timestamp) {
      setInterpretation(null);
      return;
    }
    let cancelled = false;
    setInterpretationLoading(true);
    setInterpretationError(null);
    const params = new URLSearchParams({
      symbol: meta.symbol,
      timeframe: meta.timeframe,
      timestamp: current.timestamp,
    });
    const overridesFragment = getActiveOverridesQueryFragment();
    fetch(`/api/alignment-engine/interpretation?${params}${overridesFragment}`)
      .then((r) => r.json())
      .then((body: { interpretation?: MarketInterpretation | null; error?: string }) => {
        if (cancelled) return;
        if (body.error && !body.interpretation) {
          setInterpretationError(body.error);
          setInterpretation(null);
        } else {
          setInterpretation(body.interpretation ?? null);
          setInterpretationError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setInterpretationError(e instanceof Error ? e.message : "Failed to load interpretation");
          setInterpretation(null);
        }
      })
      .finally(() => {
        if (!cancelled) setInterpretationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.symbol, meta.timeframe, current?.timestamp, multiTfView, engine2VersionKey]);

  useEffect(() => {
    if (!multiTfView || !meta.symbol) {
      setMultiTfData(null);
      return;
    }
    let cancelled = false;
    setMultiTfLoading(true);
    const overridesFragment = getActiveOverridesQueryFragment();
    fetch(`/api/alignment-engine/interpretation?symbol=${encodeURIComponent(meta.symbol)}&multiTf=1${overridesFragment}`)
      .then((r) => r.json())
      .then((body: { interpretations?: (MarketInterpretation & { timeframe: string; timestamp?: string })[]; globalBiasBanner?: string; error?: string }) => {
        if (cancelled) return;
        if (body.error) {
          setMultiTfData(null);
        } else {
          setMultiTfData({
            interpretations: body.interpretations ?? [],
            globalBiasBanner: body.globalBiasBanner,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMultiTfData(null);
      })
      .finally(() => {
        if (!cancelled) setMultiTfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [multiTfView, meta.symbol, engine2VersionKey]);

  const plotlyResult = useMemo(() => {
    if (!current) return { data: [], layout: { shapes: [], annotations: [] } };
    return frameToPlotly(current, indicatorVisibility, waveState);
  }, [current, indicatorVisibility, waveState]);

  const handlePlayPause = useCallback(() => setIsPlaying((p) => !p), [setIsPlaying]);
  const handleReverse = useCallback(() => setIsReversed((r) => !r), [setIsReversed]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      if (e.deltaY > 0) stepForward();
      else if (e.deltaY < 0) stepBack();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stepForward, stepBack]);

  const toolbarContent = (
    <>
      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        {current?.timestamp ? formatTimestampEST(current.timestamp) : "—"}
      </span>
      <span className="text-sm text-muted-foreground">
        {meta.symbol} · {meta.timeframe}
      </span>
      <span className="text-sm text-muted-foreground">Timeframe</span>
      <Select value={selectedDatasetId} onValueChange={onDatasetChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Chart" />
        </SelectTrigger>
        <SelectContent>
          {datasets.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <JumpToEvent
        frames={frames}
        currentFrame={currentFrame}
        onJump={(idx) => {
          goToFrame(idx);
          setIsPlaying(false);
        }}
      />
    </>
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      {/* Top toolbar: ribbon with π opens drawer (same pattern as right Engine 2 drawer) */}
      <Drawer
        direction="top"
        modal={false}
        open={topBarOpen}
        onOpenChange={setTopBarOpen}
      >
        <div className="fixed top-0 left-1/2 z-40 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            className="nav-tab-trigger-top h-8 w-8 rounded-b-lg rounded-t-none p-0 text-base"
            title="Open chart toolbar"
            aria-label="Open chart toolbar"
            onClick={() => setTopBarOpen((open) => !open)}
          >
            <span className="pi-icon" aria-hidden>π</span>
          </Button>
        </div>
        <DrawerContent
          direction="top"
          showOverlay={false}
          className="rounded-b-xl border-b shadow-lg"
        >
          <DrawerTitle className="sr-only">Chart toolbar</DrawerTitle>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 md:gap-4">
            {toolbarContent}
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Close toolbar"
              >
                <X className="size-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="relative flex min-h-0 flex-1 flex-col p-4" style={{ minHeight: 0 }}>
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border-2 bg-card p-2"
          style={{ minHeight: 0, borderColor: "rgba(50, 54, 62, 0.95)" }}
        >
          <div ref={chartContainerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <SMCChart
              data={plotlyResult.data}
              layout={plotlyResult.layout}
              yRange={chartSettings.squaredRange}
              yAxisType={chartSettings.logScale ? "log" : "linear"}
            />
            {/* Engine 2: Drawer from the right, two-stage (cards then cards + diagnostics); trigger is in footer */}
            <Drawer
              direction="right"
              modal={false}
              open={trayStage !== "closed"}
              onOpenChange={(open) => {
                if (open) setTrayStage((s) => (s === "closed" ? "cards" : s));
                else setTrayStage("closed");
              }}
            >
              <DrawerContent
                showOverlay={false}
                className="top-0 mt-0 h-full max-h-full rounded-none border-l transition-[width] duration-300 ease-out"
                style={{
                  width:
                    trayStage === "cardsAndDiagnostics"
                      ? "min(880px, 92vw)"
                      : "min(520px, 90vw)",
                }}
              >
                <DrawerTitle className="sr-only">Engine 2</DrawerTitle>
                <div className="no-scrollbar flex h-full flex-1 flex-row overflow-y-auto">
                  <div className="flex w-[460px] min-w-[460px] shrink-0 flex-col gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Tabs
                        value={multiTfView ? "multi" : "current"}
                        onValueChange={(v) => setMultiTfView(v === "multi")}
                      >
                        <TabsList>
                          <TabsTrigger value="current">
                            <BarChart2 aria-hidden />
                            Current bar
                          </TabsTrigger>
                          <TabsTrigger value="multi">
                            <LayoutGrid aria-hidden />
                            Multi-TF
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <div className="flex items-center gap-1">
                        <Link href="/engine2" className="text-xs text-primary underline">
                          Open Engine 2 hub
                        </Link>
                        {trayStage === "cards" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setTrayStage("cardsAndDiagnostics")}
                            title="Open diagnostics panel"
                            aria-label="Open diagnostics panel"
                          >
                            <Columns2 className="size-4" aria-hidden />
                          </Button>
                        )}
                        {trayStage === "cardsAndDiagnostics" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1"
                            onClick={() => setTrayStage("cards")}
                            title="Close diagnostics panel"
                            aria-label="Close diagnostics panel"
                          >
                            <Square className="size-4" aria-hidden />
                          </Button>
                        )}
                        <DrawerClose asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1"
                            title="Close panel"
                            aria-label="Close Engine 2 panel"
                          >
                            <SquareX className="size-4" aria-hidden />
                          </Button>
                        </DrawerClose>
                      </div>
                    </div>
                    <AlignmentPanel
                      interpretation={multiTfView ? null : interpretation}
                      multiTfInterpretations={
                        multiTfView ? multiTfData?.interpretations : undefined
                      }
                      globalBiasBanner={
                        multiTfView ? multiTfData?.globalBiasBanner : null
                      }
                      loading={
                        multiTfView ? multiTfLoading : interpretationLoading
                      }
                      currentTimeframe={meta.timeframe ?? null}
                    />
                    {interpretationError && !multiTfView && (
                      <p className="text-xs text-destructive">
                        {interpretationError}
                      </p>
                    )}
                  </div>
                  {trayStage === "cardsAndDiagnostics" && (
                    <div className="animate-in slide-in-from-right-4 flex min-w-0 shrink-0 flex-1 duration-300 ease-out">
                      <DiagnosticsPanel
                        symbol={meta.symbol ?? ""}
                        timeframe={meta.timeframe ?? ""}
                        currentTimestamp={current?.timestamp ?? null}
                        interpretation={interpretation}
                      />
                    </div>
                  )}
                </div>
              </DrawerContent>
            </Drawer>

            {/* Aggregate diagnostics: bottom drawer */}
            <Drawer
              direction="bottom"
              open={aggregateDrawerOpen}
              onOpenChange={setAggregateDrawerOpen}
            >
              <DrawerContent direction="bottom" showOverlay className="flex h-[95vh] max-h-[95vh] flex-col">
                <DrawerTitle className="sr-only">Aggregate Engine 2 diagnostics</DrawerTitle>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-foreground">
                        All timeframes
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Engine 2 Diagnostics — Comparative View · {meta.symbol} · Cross-timeframe outcome, gating, signal density, and role classification.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => aggregatePanelRef.current?.runAll()}
                        disabled={!meta.symbol || aggregatePanelState.loading}
                      >
                        {aggregatePanelState.loading ? "Running all…" : "Run all timeframes"}
                      </Button>
                      <Link href="/engine2">
                        <Button variant="outline" size="sm">
                          Open Engine 2 hub
                        </Button>
                      </Link>
                      {aggregatePanelState.hasResults && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => aggregatePanelRef.current?.exportMarkdown()}
                        >
                          <Download className="size-3.5" />
                          {aggregatePanelState.copyStatus === "copied" ? "Copied" : "Export grid as Markdown"}
                        </Button>
                      )}
                      <DrawerClose asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Close">
                          <X className="size-4" />
                        </Button>
                      </DrawerClose>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <AggregateDiagnosticsPanel
                      ref={aggregatePanelRef}
                      symbol={meta.symbol ?? ""}
                      onStateChange={setAggregatePanelState}
                    />
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </main>
      </div>

      {/* Engine 2 tab: floats above footer like left nav tab, does not push down playback */}
      <div className="fixed bottom-24 right-0 z-40">
        <Button
          variant="secondary"
          size="sm"
          className="nav-tab-trigger nav-tab-trigger-right h-10 w-10 rounded-l-md rounded-r-none border border-r-0 p-0"
          title="Open Engine 2 panel"
          aria-label="Open Engine 2 panel"
          onClick={() =>
            setTrayStage(trayStage === "closed" ? "cards" : "closed")
          }
        >
          <Wand className="size-4 shrink-0" aria-hidden />
        </Button>
      </div>

      <footer className="shrink-0 border-t border-border">
        <button
          type="button"
          onClick={() => setPlaybackExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
          aria-expanded={playbackExpanded}
          aria-label={playbackExpanded ? "Collapse playback" : "Expand playback"}
        >
          <span>Playback</span>
          {playbackExpanded ? (
            <ChevronUp className="size-4 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          )}
        </button>
        {playbackExpanded && (
          <div className="border-t border-border p-4">
            <PlaybackControls
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              speed={speed}
              onSpeedChange={setSpeed}
              isReversed={isReversed}
              onReverse={handleReverse}
              onFrameChange={goToFrame}
              onStepBack={stepBack}
              onStepForward={stepForward}
            />
          </div>
        )}
      </footer>
    </div>
  );
}
