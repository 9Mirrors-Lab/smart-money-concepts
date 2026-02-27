"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { IndicatorId } from "./smc-types";
import { INDICATOR_IDS } from "./smc-types";
import type { ChartBackground as ChartBackgroundType } from "./frame-to-plotly";

const DEFAULT_VISIBILITY: Record<IndicatorId, boolean> = {
  candles: true,
  fvg: false,
  swing: false,
  fib: false,
  bos: false,
  choch: false,
  ob: false,
  liquidity: false,
  phl: false,
  sessionsAsia: false,
  sessionsLondon: false,
  sessionsNYAM: false,
  sessionsNYPM: false,
  retracements: false,
  ewo: true,
  sma5: false,
  sma35: false,
  box: true,
} as Record<IndicatorId, boolean>;

export interface ChartMeta {
  symbol: string;
  timeframe: string;
}

export type ChartBackground = ChartBackgroundType;

/** Which calculator field the next chart click will fill. */
export type CalcClickSlot = "high" | "low" | null;

export interface ChartSettingsState {
  indicatorVisibility: Record<IndicatorId, boolean>;
  toggleIndicator: (id: IndicatorId) => void;
  setCandlesOnly: () => void;
  chartMeta: ChartMeta | null;
  onChartRefresh: (() => void) | null;
  swingLowInput: string;
  setSwingLowInput: (v: string) => void;
  swingHighInput: string;
  setSwingHighInput: (v: string) => void;
  logScale: boolean;
  setLogScale: (v: boolean) => void;
  squaredRange: [number, number] | null;
  setSquaredRange: (v: [number, number] | null) => void;
  handleSquareChart: () => void;
  handleClearSquare: () => void;
  chartBackground: ChartBackground;
  setChartBackground: (v: ChartBackground) => void;
  chartBackgroundHex: string;
  setChartBackgroundHex: (v: string) => void;
  /** Calculator click-to-fill: which slot is awaiting a chart click */
  calcClickSlot: CalcClickSlot;
  setCalcClickSlot: (slot: CalcClickSlot) => void;
  /** Last price clicked on the chart (pushed from SMCChart onClick) */
  lastChartClickPrice: number | null;
  setLastChartClickPrice: (price: number) => void;
  clearLastChartClickPrice: () => void;
  /** Whether the indicator list is pinned inside the nav drawer */
  indicatorsPinned: boolean;
  setIndicatorsPinned: (v: boolean) => void;
  /** Per-indicator opacity overrides (0–1). Only FVG, OB, and sessions are supported. */
  indicatorOpacity: Partial<Record<IndicatorId, number>>;
  setIndicatorOpacity: (id: IndicatorId, value: number) => void;
}

const defaultState: ChartSettingsState = {
  indicatorVisibility: DEFAULT_VISIBILITY,
  toggleIndicator: () => {},
  setCandlesOnly: () => {},
  chartMeta: null,
  onChartRefresh: null,
  swingLowInput: "",
  setSwingLowInput: () => {},
  swingHighInput: "",
  setSwingHighInput: () => {},
  logScale: false,
  setLogScale: () => {},
  squaredRange: null,
  setSquaredRange: () => {},
  handleSquareChart: () => {},
  handleClearSquare: () => {},
  chartBackground: "custom" as ChartBackground,
  setChartBackground: () => {},
  chartBackgroundHex: "#282828",
  setChartBackgroundHex: () => {},
  calcClickSlot: null,
  setCalcClickSlot: () => {},
  lastChartClickPrice: null,
  setLastChartClickPrice: () => {},
  clearLastChartClickPrice: () => {},
  indicatorsPinned: true,
  setIndicatorsPinned: () => {},
  indicatorOpacity: {},
  setIndicatorOpacity: () => {},
};

export interface ChartSettingsRegistration {
  registerChart: (opts: {
    indicatorVisibility: Record<IndicatorId, boolean>;
    toggleIndicator: (id: IndicatorId) => void;
    setCandlesOnly: () => void;
    chartMeta: ChartMeta;
    onChartRefresh: () => void;
  }) => void;
  unregisterChart: () => void;
  syncIndicatorVisibility: (v: Record<IndicatorId, boolean>) => void;
}

type ChartSettingsContextValue = ChartSettingsState & ChartSettingsRegistration;

const ChartSettingsContext = createContext<ChartSettingsContextValue | null>(null);

export function ChartSettingsProvider({ children }: { children: ReactNode }) {
  const [indicatorVisibility, setIndicatorVisibility] = useState<Record<IndicatorId, boolean>>(DEFAULT_VISIBILITY);
  const [chartMeta, setChartMeta] = useState<ChartMeta | null>(null);
  const [onChartRefresh, setOnChartRefresh] = useState<(() => void) | null>(null);
  const [swingLowInput, setSwingLowInput] = useState("");
  const [swingHighInput, setSwingHighInput] = useState("");
  const [logScale, setLogScale] = useState(false);
  const [squaredRange, setSquaredRange] = useState<[number, number] | null>(null);
  const [chartBackground, setChartBackground] = useState<ChartBackground>("custom");
  const [chartBackgroundHex, setChartBackgroundHex] = useState<string>("#282828");
  const [calcClickSlot, setCalcClickSlot] = useState<CalcClickSlot>(null);
  const [lastChartClickPrice, setLastChartClickPriceState] = useState<number | null>(null);
  const [indicatorsPinned, setIndicatorsPinned] = useState(true);
  const [indicatorOpacity, setIndicatorOpacityState] = useState<Partial<Record<IndicatorId, number>>>({});

  const setIndicatorOpacity = useCallback((id: IndicatorId, value: number) => {
    setIndicatorOpacityState((prev) => ({ ...prev, [id]: value }));
  }, []);

  const setLastChartClickPrice = useCallback((price: number) => {
    setLastChartClickPriceState(price);
  }, []);

  const clearLastChartClickPrice = useCallback(() => {
    setLastChartClickPriceState(null);
  }, []);

  const chartCallbacks = useRef<{
    toggleIndicator: (id: IndicatorId) => void;
    setCandlesOnly: () => void;
  } | null>(null);

  const toggleIndicator = useCallback((id: IndicatorId) => {
    if (chartCallbacks.current?.toggleIndicator) {
      chartCallbacks.current.toggleIndicator(id);
    } else {
      setIndicatorVisibility((v) => ({ ...v, [id]: !v[id] }));
    }
  }, []);

  const setCandlesOnly = useCallback(() => {
    if (chartCallbacks.current?.setCandlesOnly) {
      chartCallbacks.current.setCandlesOnly();
    } else {
      setIndicatorVisibility(
        () =>
          Object.fromEntries(INDICATOR_IDS.map((id) => [id, id === "candles"])) as Record<IndicatorId, boolean>
      );
    }
  }, []);

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

  const value: ChartSettingsContextValue = {
    ...defaultState,
    indicatorVisibility,
    toggleIndicator,
    setCandlesOnly,
    chartMeta,
    onChartRefresh,
    swingLowInput,
    setSwingLowInput,
    swingHighInput,
    setSwingHighInput,
    logScale,
    setLogScale,
    squaredRange,
    setSquaredRange,
    handleSquareChart,
    handleClearSquare,
    chartBackground,
    setChartBackground,
    chartBackgroundHex,
    setChartBackgroundHex,
    calcClickSlot,
    setCalcClickSlot,
    lastChartClickPrice,
    setLastChartClickPrice,
    clearLastChartClickPrice,
    indicatorsPinned,
    setIndicatorsPinned,
    indicatorOpacity,
    setIndicatorOpacity,
    registerChart: useCallback((opts) => {
      chartCallbacks.current = {
        toggleIndicator: opts.toggleIndicator,
        setCandlesOnly: opts.setCandlesOnly,
      };
      setIndicatorVisibility(opts.indicatorVisibility);
      setChartMeta(opts.chartMeta);
      setOnChartRefresh(() => opts.onChartRefresh);
    }, []),
    unregisterChart: useCallback(() => {
      chartCallbacks.current = null;
      setChartMeta(null);
      setOnChartRefresh(null);
    }, []),
    syncIndicatorVisibility: useCallback((v) => {
      setIndicatorVisibility(v);
    }, []),
  };

  return (
    <ChartSettingsContext.Provider value={value}>
      {children}
    </ChartSettingsContext.Provider>
  );
}

export function useChartSettings(): ChartSettingsState {
  const ctx = useContext(ChartSettingsContext);
  if (!ctx) return defaultState;
  return ctx;
}

export function useChartSettingsRegistration(): ChartSettingsContextValue {
  const ctx = useContext(ChartSettingsContext);
  if (!ctx) throw new Error("useChartSettingsRegistration must be used within ChartSettingsProvider");
  return ctx;
}
