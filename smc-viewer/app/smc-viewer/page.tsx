"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SMCChart } from "@/components/chart";
import { IndicatorPanel } from "@/components/indicator-panel";
import { JumpToEvent } from "@/components/jump-to-event";
import { TimeConverter } from "@/components/time-converter";
import { ExportPanel } from "@/components/export-panel";
import { PlaybackControls } from "@/components/playback-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
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
  DrawerTrigger,
} from "@/components/ui/drawer";
import { formatTimestampEST } from "@/lib/format-time";
import { frameToPlotly, type WaveStateRow } from "@/lib/frame-to-plotly";
import { getActiveOverridesQueryFragment, getVersionStore } from "@/lib/engine2-version-store";
import type { MarketInterpretation } from "@/lib/interpretation-engine";
import type { SMCDataset, SMCFrame } from "@/lib/smc-types";
import { useSMCPlayer } from "@/lib/use-smc-player";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns2, Square, SquareX, X, Download, BarChart2, LayoutGrid } from "lucide-react";
import { ChartNavBar } from "@/components/app-nav";

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

  const [squaredRange, setSquaredRange] = useState<[number, number] | null>(null);
  const [swingLowInput, setSwingLowInput] = useState("");
  const [swingHighInput, setSwingHighInput] = useState("");
  const [logScale, setLogScale] = useState(false);

  const handleSquareChart = useCallback(() => {
    const low = Number.parseFloat(swingLowInput);
    const high = Number.parseFloat(swingHighInput);
    if (Number.isFinite(low) && Number.isFinite(high) && low < high) {
      setSquaredRange([low, high]);
    }
  }, [swingLowInput, swingHighInput]);

  const handleClearSquare = useCallback(() => {
    setSquaredRange(null);
  }, []);

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

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <ChartNavBar
        rightContent={
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Settings
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] max-h-[85vh] overflow-y-auto p-0" align="start">
                <PopoverHeader className="px-4 pt-3">
                  <PopoverTitle>Settings</PopoverTitle>
                  <PopoverDescription>
                    Chart display, export, time conversion, and square chart.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col border-t border-border">
                  <div className="border-b border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Indicators</p>
                    <IndicatorPanel
                      visibility={indicatorVisibility}
                      onToggle={toggleIndicator}
                      onCandlesOnly={setCandlesOnly}
                    />
                  </div>
                  <div className="border-b border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">DB Export</p>
                    <ExportPanel
                      symbol={meta.symbol ?? ""}
                      currentTimeframe={meta.timeframe ?? "23"}
                      onExportSuccess={onRefresh}
                    />
                  </div>
                  <div className="border-b border-border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Time conversion</p>
                    <TimeConverter />
                  </div>
                  <div className="p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Square chart</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Set Y-axis to a swing low and swing high so the chart frames that range.
                    </p>
                    <div className="space-y-2">
                      <label htmlFor="square-low" className="text-xs text-muted-foreground">
                        Swing low
                      </label>
                      <input
                        id="square-low"
                        type="number"
                        step="any"
                        placeholder="e.g. 3200"
                        value={swingLowInput}
                        onChange={(e) => setSwingLowInput(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="mt-2 space-y-2">
                      <label htmlFor="square-high" className="text-xs text-muted-foreground">
                        Swing high
                      </label>
                      <input
                        id="square-high"
                        type="number"
                        step="any"
                        placeholder="e.g. 3400"
                        value={swingHighInput}
                        onChange={(e) => setSwingHighInput(e.target.value)}
                        className="border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" onClick={handleSquareChart}>
                        Square chart
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={handleClearSquare}>
                        Clear
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center space-x-2">
                      <Checkbox
                        id="square-log-scale"
                        checked={logScale}
                        onCheckedChange={(c) => setLogScale(c === true)}
                      />
                      <Label htmlFor="square-log-scale" className="cursor-pointer text-sm font-normal">
                        Log scale (Y-axis)
                      </Label>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <JumpToEvent
              frames={frames}
              currentFrame={currentFrame}
              onJump={(idx) => {
                goToFrame(idx);
                setIsPlaying(false);
              }}
            />
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1 flex-col p-4" style={{ minHeight: 0 }}>
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border-2 bg-card p-2"
          style={{ minHeight: 0, borderColor: "rgba(50, 54, 62, 0.95)" }}
        >
          <div ref={chartContainerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <SMCChart
              data={plotlyResult.data}
              layout={plotlyResult.layout}
              yRange={squaredRange}
              yAxisType={logScale ? "log" : "linear"}
            />
            {/* Engine 2: Drawer from the right, two-stage (cards then cards + diagnostics) */}
            <Drawer
              direction="right"
              modal={false}
              open={trayStage !== "closed"}
              onOpenChange={(open) => {
                if (open) setTrayStage((s) => (s === "closed" ? "cards" : s));
                else setTrayStage("closed");
              }}
            >
              <div className="absolute right-0 top-0 z-40 flex h-full flex-col justify-center">
                <DrawerTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-12 rounded-l-md rounded-r-none border border-r-0 border-border shadow-md"
                    title="Open Engine 2 panel"
                    aria-label="Open Engine 2 panel"
                  >
                    <span className="text-xs font-medium">Engine 2</span>
                    <Columns2 className="ml-1 size-4 shrink-0" aria-hidden />
                  </Button>
                </DrawerTrigger>
              </div>
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
                      <Link href="/engine2-checklist">
                        <Button variant="outline" size="sm">
                          Diagnostic checklist
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

      <footer className="shrink-0 border-t border-border p-4">
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
      </footer>
    </div>
  );
}
