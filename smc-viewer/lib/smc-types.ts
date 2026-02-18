/** Numeric value or null (from JSON NaN) */
export type Num = number | null;

export interface OHLC {
  x: string[];
  open: Num[];
  high: Num[];
  low: Num[];
  close: Num[];
}

export interface FVGData {
  FVG: Num[];
  Top: Num[];
  Bottom: Num[];
  MitigatedIndex: Num[];
}

export interface SwingHighsLowsData {
  HighLow: Num[];
  Level: Num[];
}

export interface BosChochData {
  BOS: Num[];
  CHOCH: Num[];
  Level: Num[];
  BrokenIndex: Num[];
}

export interface OBData {
  OB: Num[];
  Top: Num[];
  Bottom: Num[];
  MitigatedIndex: Num[];
  OBVolume?: Num[];
  Percentage?: Num[];
}

export interface LiquidityData {
  Liquidity: Num[];
  Level: Num[];
  End: Num[];
  Swept: Num[];
}

export interface PreviousHighLowData {
  PreviousHigh: Num[];
  PreviousLow: Num[];
  BrokenHigh?: Num[];
  BrokenLow?: Num[];
}

export interface SessionsData {
  Active: Num[];
  High: Num[];
  Low: Num[];
}

/** Sessions for all trading windows (Asia, London, NYAM, NYPM) */
export interface AllSessionsData {
  asia: SessionsData;
  london: SessionsData;
  nyam: SessionsData;
  nypm: SessionsData;
}

export interface RetracementsData {
  Direction: Num[];
  "CurrentRetracement%": Num[];
  "DeepestRetracement%": Num[];
}

/** Elliott Wave Oscillator values per bar (optional; from market_candles_ewo). */
export interface EWOData {
  values: Num[];
}

export interface SMCFrame {
  index: number;
  timestamp: string;
  ohlc: OHLC;
  fvg: FVGData;
  swingHighsLows: SwingHighsLowsData;
  bosChoch: BosChochData;
  ob: OBData;
  liquidity: LiquidityData;
  previousHighLow: PreviousHighLowData;
  sessions: AllSessionsData;
  retracements: RetracementsData;
  /** Elliott Wave Oscillator; when present, can be toggled on the chart. */
  ewo?: Num[] | EWOData;
  /** SMA 5 (price); from market_candles_ewo, toggleable. */
  sma5?: Num[];
  /** SMA 35 (price); from market_candles_ewo, toggleable. */
  sma35?: Num[];
  /** Wave number per bar from wave_engine_state: "3"|"4"|"5" or null; aligned to ohlc. */
  wave_number?: (string | null)[];
}

export interface SMCMeta {
  symbol: string;
  timeframe: string;
  windowSize: number;
  barCount: number;
}

export interface SMCDataset {
  meta: SMCMeta;
  frames: SMCFrame[];
}

export const INDICATOR_IDS = [
  "candles",
  "fvg",
  "swing",
  "fib",
  "bos",
  "choch",
  "ob",
  "liquidity",
  "phl",
  "sessionsAsia",
  "sessionsLondon",
  "sessionsNYAM",
  "sessionsNYPM",
  "retracements",
  "ewo",
  "sma5",
  "sma35",
] as const;

export type IndicatorId = (typeof INDICATOR_IDS)[number];

export const SESSION_INDICATOR_IDS = [
  "sessionsAsia",
  "sessionsLondon",
  "sessionsNYAM",
  "sessionsNYPM",
] as const;

export type SessionIndicatorId = (typeof SESSION_INDICATOR_IDS)[number];

export const INDICATOR_LABELS: Record<IndicatorId, string> = {
  candles: "Candles",
  fvg: "FVG",
  swing: "Swing H/L",
  fib: "Fib (Asia H/L)",
  bos: "BOS",
  choch: "CHoCH",
  ob: "Order blocks",
  liquidity: "Liquidity",
  phl: "PH/PL",
  sessionsAsia: "Asia",
  sessionsLondon: "London",
  sessionsNYAM: "NY AM",
  sessionsNYPM: "NY PM",
  retracements: "Retracements",
  ewo: "Elliott Wave (EWO)",
  sma5: "SMA 5",
  sma35: "SMA 35",
};
