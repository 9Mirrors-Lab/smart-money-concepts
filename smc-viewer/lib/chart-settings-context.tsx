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

const DEFAULT_VISIBILITY: Record<IndicatorId, boolean> = {
  candles: true,
  fvg: true,
  swing: true,
  fib: false,
  bos: true,
  choch: true,
  ob: true,
  liquidity: true,
  phl: false,
  sessionsAsia: true,
  sessionsLondon: false,
  sessionsNYAM: false,
  sessionsNYPM: false,
  retracements: false,
  ewo: true,
  sma5: false,
  sma35: false,
} as Record<IndicatorId, boolean>;

export interface ChartMeta {
  symbol: string;
  timeframe: string;
}

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
