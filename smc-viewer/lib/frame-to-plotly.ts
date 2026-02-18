import type {
  SMCFrame,
  IndicatorId,
  OHLC,
  Num,
} from "./smc-types";

/** Plotly trace (minimal shape for our use) */
export type PlotlyTrace = Record<string, unknown>;
/** Plotly shape */
export type PlotlyShape = Record<string, unknown>;
/** Plotly annotation */
export type PlotlyAnnotation = Record<string, unknown>;

const DARK_LAYOUT = {
  paper_bgcolor: "rgba(40, 40, 40, 1)",
  plot_bgcolor: "rgba(40, 40, 40, 1)",
  font: { color: "white" },
  margin: { l: 10, r: 70, b: 50, t: 10 },
  xaxis: {
    type: "date",
    rangeslider: { visible: false },
    tickformat: "%m/%d\n%I:%M %p",
    hoverformat: "%b %d, %Y %I:%M %p",
    tickfont: { color: "rgba(255,255,255,0.8)", size: 10 },
    gridcolor: "rgba(255,255,255,0.1)",
    side: "bottom" as const,
    dtick: 7 * 24 * 60 * 60 * 1000, // 1 week
    tick0: "2020-01-06", // Monday – ticks show every Monday
  },
  yaxis: {
    tickfont: { color: "rgba(255,255,255,0.8)", size: 10 },
    gridcolor: "rgba(255,255,255,0.1)",
    side: "right" as const,
    title: { text: "Price", font: { color: "rgba(255,255,255,0.8)", size: 10 } },
  },
  showlegend: false,
};

function isNum(v: Num): v is number {
  return v !== null && !Number.isNaN(v);
}

function getEWOValues(frame: SMCFrame): Num[] | null {
  const ewo = frame.ewo;
  if (!ewo) return null;
  const arr = Array.isArray(ewo) ? ewo : "values" in ewo ? ewo.values : null;
  if (!arr || arr.length === 0) return null;
  return arr;
}

/** Base EWO line: thin and gray so Wave 3/4/5 overlays stand out. */
function addEWOTrace(frame: SMCFrame): PlotlyTrace | null {
  const values = getEWOValues(frame);
  if (!values || !frame.ohlc.x.length) return null;
  const y = values.length === frame.ohlc.x.length
    ? values
    : [...values, ...Array(Math.max(0, frame.ohlc.x.length - values.length)).fill(null)];
  return {
    type: "scatter",
    mode: "lines",
    x: frame.ohlc.x,
    y: y.slice(0, frame.ohlc.x.length),
    name: "EWO",
    line: { color: "rgba(140, 140, 140, 0.55)", width: 1 },
    xaxis: "x2",
    yaxis: "y2",
    legendgroup: "ewo",
  };
}

/** Y-axis for the EWO pane (timeline-strip style: no grid; autorange so the line is always visible). */
const EWO_YAXIS2 = {
  title: { text: "EWO", font: { color: "rgba(255,255,255,0.8)", size: 10 } },
  tickfont: { color: "rgba(255,255,255,0.8)", size: 10 },
  showgrid: false,
  zeroline: true,
  zerolinecolor: "rgba(255,255,255,0.2)",
  side: "right" as const,
  anchor: "x2",
  autorange: true,
  rangemode: "tozero" as const,
};

/** X-axis for the EWO pane (no date labels; pane 1 shows the date). */
const EWO_XAXIS2 = {
  type: "date" as const,
  rangeslider: { visible: false },
  showticklabels: false,
  showgrid: false,
  side: "bottom" as const,
  anchor: "y2",
};

/** Wave state row from API (GET /api/wave-engine/state). */
export interface WaveStateRow {
  timestamp: string;
  wave_number?: string | number | null;
}

/** Coerce wave_number to "3"|"4"|"5" or null (API may return string or number). */
function normalizeWaveNumber(wn: string | number | null | undefined): string | null {
  if (wn == null) return null;
  const s = String(wn).trim();
  return s === "NONE" || s === "" ? null : s === "3" || s === "4" || s === "5" ? s : null;
}

/** Build wave_number array for a frame by matching timestamps to wave state (API data).
 * Frame ohlc.x and wave_engine_state use the same timestamp strings (no conversion in export or viewer). */
export function buildWaveNumberForFrame(
  frame: SMCFrame,
  waveState: WaveStateRow[]
): (string | null)[] {
  if (!waveState.length || !frame.ohlc.x.length) return [];
  const map = new Map<string, string | null>();
  for (const r of waveState) {
    const t = r.timestamp;
    if (t == null) continue;
    map.set(t, normalizeWaveNumber(r.wave_number));
  }
  return frame.ohlc.x.map((ts) => map.get(ts) ?? null);
}

function getWaveNumbers(frame: SMCFrame): (string | null)[] | null {
  const wn = frame.wave_number;
  if (!wn || !Array.isArray(wn) || wn.length === 0) return null;
  return wn;
}

/** Thick EWO segment for one wave (3, 4, or 5); y is EWO value only where wave_number matches, else null. */
function addWaveOverlayTrace(
  frame: SMCFrame,
  waveNum: "3" | "4" | "5",
  label: string,
  color: string
): PlotlyTrace | null {
  const ewo = getEWOValues(frame);
  const waveNumbers = getWaveNumbers(frame);
  if (!ewo || !waveNumbers || !frame.ohlc.x.length) return null;
  const n = frame.ohlc.x.length;
  const y = ewo.slice(0, n).map((v, i) => {
    const w = waveNumbers[i];
    return w === waveNum && v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  });
  if (y.every((v) => v == null)) return null;
  return {
    type: "scatter",
    mode: "lines",
    x: frame.ohlc.x,
    y,
    name: label,
    line: { color, width: 3 },
    xaxis: "x2",
    yaxis: "y2",
    legendgroup: `wave${waveNum}`,
  };
}

/** Scatter text labels "3", "4", "5" on the EWO line at each bar with that wave number. */
function addWaveNumberLabelTrace(frame: SMCFrame): PlotlyTrace | null {
  const ewo = getEWOValues(frame);
  const waveNumbers = getWaveNumbers(frame);
  if (!ewo || !waveNumbers || !frame.ohlc.x.length) return null;
  const n = Math.min(frame.ohlc.x.length, ewo.length, waveNumbers.length);
  const x: string[] = [];
  const y: (number | null)[] = [];
  const text: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = waveNumbers[i];
    if (w !== "3" && w !== "4" && w !== "5") continue;
    const v = ewo[i];
    if (v == null || Number.isNaN(Number(v))) continue;
    x.push(frame.ohlc.x[i]);
    y.push(Number(v));
    text.push(w);
  }
  if (x.length === 0) return null;
  return {
    type: "scatter",
    mode: "text",
    x,
    y,
    text,
    textposition: "top center",
    textfont: { color: "rgba(255,255,255,0.95)", size: 10 },
    xaxis: "x2",
    yaxis: "y2",
    legendgroup: "waveLabels",
    name: "Wave #",
  };
}

function getSMAValues(frame: SMCFrame, key: "sma5" | "sma35"): Num[] | null {
  const arr = frame[key];
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return arr;
}

function addSMATrace(
  frame: SMCFrame,
  key: "sma5" | "sma35",
  label: string,
  color: string
): PlotlyTrace | null {
  const values = getSMAValues(frame, key);
  if (!values || !frame.ohlc.x.length) return null;
  const n = frame.ohlc.x.length;
  const yRaw =
    values.length === n
      ? values
      : [...values, ...Array(Math.max(0, n - values.length)).fill(null)];
  const y = yRaw.slice(0, n).map((v) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null));
  if (y.every((v) => v == null)) return null;
  return {
    type: "scatter",
    mode: "lines",
    x: frame.ohlc.x,
    y,
    name: label,
    line: { color, width: 1.5 },
    legendgroup: key,
    yaxis: "y",
    xaxis: "x",
  };
}

export interface FramePlotlyResult {
  data: PlotlyTrace[];
  layout: {
    shapes: PlotlyShape[];
    annotations: PlotlyAnnotation[];
    [key: string]: unknown;
  };
}

const TEXT_FONT = { color: "rgba(255, 255, 255, 0.4)", size: 8 };

function addCandlestickTrace(ohlc: OHLC): PlotlyTrace {
  return {
    type: "candlestick",
    x: ohlc.x,
    open: ohlc.open,
    high: ohlc.high,
    low: ohlc.low,
    close: ohlc.close,
    increasing: {
      line: { color: "rgb(209, 177, 116)" },
      fillcolor: "rgb(209, 177, 116)",
    },
    decreasing: {
      line: { color: "rgb(219, 80, 72)" },
      fillcolor: "rgb(219, 80, 72)",
    },
    name: "Candles",
    legendgroup: "candles",
    xaxis: "x",
    yaxis: "y",
  };
}

function addFVGTraces(frame: SMCFrame): { traces: PlotlyTrace[]; shapes: PlotlyShape[] } {
  const traces: PlotlyTrace[] = [];
  const shapes: PlotlyShape[] = [];
  const { fvg, ohlc } = frame;
  const n = fvg.FVG.length;
  for (let i = 0; i < n; i++) {
    if (!isNum(fvg.FVG[i])) continue;
    const x1Raw = fvg.MitigatedIndex[i];
    const x1 = isNum(x1Raw) && x1Raw !== 0 ? Math.floor(x1Raw) : n - 1;
    const x0 = ohlc.x[i];
    const x1Str = ohlc.x[x1];
    shapes.push({
      type: "rect",
      x0,
      y0: fvg.Top[i],
      x1: x1Str,
      y1: fvg.Bottom[i],
      line: { width: 0 },
      fillcolor: "yellow",
      opacity: 0.2,
    });
    const midX = ohlc.x[Math.round((i + x1) / 2)];
    const midY = ((fvg.Top[i] ?? 0) + (fvg.Bottom[i] ?? 0)) / 2;
    traces.push({
      type: "scatter",
      mode: "text",
      x: [midX],
      y: [midY],
      text: ["FVG"],
      textposition: "middle center",
      textfont: TEXT_FONT,
      legendgroup: "fvg",
      name: "FVG",
    });
  }
  return { traces, shapes };
}

function addSwingTraces(frame: SMCFrame): PlotlyTrace[] {
  const traces: PlotlyTrace[] = [];
  const { swingHighsLows, ohlc } = frame;
  const indexes: number[] = [];
  const levels: number[] = [];
  for (let i = 0; i < swingHighsLows.HighLow.length; i++) {
    if (!isNum(swingHighsLows.HighLow[i])) continue;
    indexes.push(i);
    levels.push(swingHighsLows.Level[i]!);
  }
  const swingHighColor = "rgba(180, 120, 120, 0.6)";
  const swingLowColor = "rgba(120, 180, 140, 0.6)";
  const dashStyle = "dot";

  for (let i = 0; i < indexes.length - 1; i++) {
    const isLow = swingHighsLows.HighLow[indexes[i]!] === -1;
    const color = isLow ? swingLowColor : swingHighColor;
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [ohlc.x[indexes[i]!], ohlc.x[indexes[i + 1]!]],
      y: [levels[i], levels[i]],
      line: { color, dash: dashStyle },
      legendgroup: "swing",
      name: "Swing",
    });
  }
  return traces;
}

/** Fib retracement levels: 0.25, 0.382, 0.5, 0.618 between the high and low of the Asia session. */
const FIB_RATIOS = [0.25, 0.382, 0.5, 0.618] as const;

/**
 * Direction rule: Asia session close vs open.
 * Bullish (close >= open) → retracement from low upward: price = low + range * ratio.
 * Bearish (close < open) → retracement from high downward: price = high - range * ratio.
 */
function addFibTraces(frame: SMCFrame): PlotlyTrace[] {
  const traces: PlotlyTrace[] = [];
  const { sessions, ohlc } = frame;
  if (!("asia" in sessions)) return traces;

  const asia = sessions.asia;
  let lastAsiaIdx = -1;
  for (let i = asia.Active.length - 1; i >= 0; i--) {
    if (asia.Active[i] === 1) {
      lastAsiaIdx = i;
      break;
    }
  }
  if (lastAsiaIdx < 0) return traces;

  const high = asia.High[lastAsiaIdx];
  const low = asia.Low[lastAsiaIdx];
  if (!isNum(high) || !isNum(low) || high <= low) return traces;

  const range = high - low;
  let firstAsiaIdx = lastAsiaIdx;
  while (firstAsiaIdx > 0 && asia.Active[firstAsiaIdx - 1] === 1) {
    firstAsiaIdx--;
  }

  const sessionOpen = firstAsiaIdx < ohlc.open.length ? ohlc.open[firstAsiaIdx] : null;
  const sessionClose = lastAsiaIdx < ohlc.close.length ? ohlc.close[lastAsiaIdx] : null;
  const bullish =
    isNum(sessionOpen) && isNum(sessionClose) && sessionClose >= sessionOpen;

  const xStart = ohlc.x[firstAsiaIdx];
  const xEnd = ohlc.x[ohlc.x.length - 1] ?? xStart;

  const fibColor = "rgba(180, 140, 255, 0.5)";
  for (const ratio of FIB_RATIOS) {
    const price = bullish ? low + range * ratio : high - range * ratio;
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [xStart, xEnd],
      y: [price, price],
      line: { color: fibColor, width: 1, dash: "dot" },
      legendgroup: "fib",
      name: `Fib ${ratio}`,
    });
    traces.push({
      type: "scatter",
      mode: "text",
      x: [xEnd],
      y: [price],
      text: [`${ratio}`],
      textposition: "middle left",
      textfont: { ...TEXT_FONT, color: "rgba(180, 140, 255, 0.7)", size: 9 },
      legendgroup: "fib",
      name: "Fib",
    });
  }
  return traces;
}

function addBosChochTraces(frame: SMCFrame): PlotlyTrace[] {
  const traces: PlotlyTrace[] = [];
  const { bosChoch, ohlc } = frame;
  const n = bosChoch.BOS.length;
  for (let i = 0; i < n; i++) {
    if (isNum(bosChoch.BOS[i])) {
      const brokenIdx = Math.floor(bosChoch.BrokenIndex[i] ?? i);
      const midX = ohlc.x[Math.round((i + brokenIdx) / 2)];
      const level = bosChoch.Level[i]!;
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [ohlc.x[i], ohlc.x[brokenIdx]],
        y: [level, level],
        line: { color: "rgba(255, 165, 0, 0.2)" },
        legendgroup: "bos",
        name: "BOS",
      });
      traces.push({
        type: "scatter",
        mode: "text",
        x: [midX],
        y: [level],
        text: ["BOS"],
        textposition: bosChoch.BOS[i] === 1 ? "top center" : "bottom center",
        textfont: { ...TEXT_FONT, color: "rgba(255, 165, 0, 0.4)" },
        legendgroup: "bos",
        name: "BOS",
      });
    }
    if (isNum(bosChoch.CHOCH[i])) {
      const brokenIdx = Math.floor(bosChoch.BrokenIndex[i] ?? i);
      const midX = ohlc.x[Math.round((i + brokenIdx) / 2)];
      const level = bosChoch.Level[i]!;
      const chochColor = "rgba(120, 160, 190, 0.75)";
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [ohlc.x[i], ohlc.x[brokenIdx]],
        y: [level, level],
        line: { color: chochColor },
        legendgroup: "choch",
        name: "CHoCH",
      });
      traces.push({
        type: "scatter",
        mode: "text",
        x: [midX],
        y: [level],
        text: ["CHOCH"],
        textposition: bosChoch.CHOCH[i] === 1 ? "top center" : "bottom center",
        textfont: { ...TEXT_FONT, color: chochColor },
        legendgroup: "choch",
        name: "CHoCH",
      });
    }
  }
  return traces;
}

function formatVolume(volume: number): string {
  if (volume >= 1e12) return `${(volume / 1e12).toFixed(3)}T`;
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(3)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(3)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(3)}k`;
  return volume.toFixed(2);
}

function addOBTraces(frame: SMCFrame): { traces: PlotlyTrace[]; shapes: PlotlyShape[]; annotations: PlotlyAnnotation[] } {
  const shapes: PlotlyShape[] = [];
  const annotations: PlotlyAnnotation[] = [];
  const { ob, ohlc } = frame;
  const n = ob.OB.length;
  for (let i = 0; i < n; i++) {
    if (ob.OB[i] !== 1 && ob.OB[i] !== -1) continue;
    const x1Raw = ob.MitigatedIndex[i];
    const x1 = isNum(x1Raw) && x1Raw !== 0 ? Math.floor(x1Raw) : n - 1;
    const xCenterIdx = isNum(x1Raw) && x1Raw > 0 ? i + Math.floor((x1 - i) / 2) : i + Math.floor((n - i) / 2);
    const yCenter = ((ob.Bottom[i] ?? 0) + (ob.Top[i] ?? 0)) / 2;
    const vol = ob.OBVolume?.[i] ?? 0;
    const pct = ob.Percentage?.[i] ?? 0;
    const label = `OB: ${formatVolume(vol)} (${pct}%)`;
    shapes.push({
      type: "rect",
      x0: ohlc.x[i],
      y0: ob.Bottom[i],
      x1: ohlc.x[x1],
      y1: ob.Top[i],
      line: { color: "Purple" },
      fillcolor: "Purple",
      opacity: 0.2,
      name: ob.OB[i] === 1 ? "Bullish OB" : "Bearish OB",
      legendgroup: ob.OB[i] === 1 ? "bullish ob" : "bearish ob",
    });
    annotations.push({
      x: ohlc.x[xCenterIdx],
      y: yCenter,
      xref: "x",
      yref: "y",
      align: "center",
      text: label,
      font: TEXT_FONT,
      showarrow: false,
    });
  }
  return { traces: [], shapes, annotations };
}

function addLiquidityTraces(frame: SMCFrame): PlotlyTrace[] {
  const traces: PlotlyTrace[] = [];
  const { liquidity, ohlc } = frame;
  const n = liquidity.Liquidity.length;
  for (let i = 0; i < n; i++) {
    if (!isNum(liquidity.Liquidity[i])) continue;
    const endIdx = Math.floor(liquidity.End[i] ?? i);
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [ohlc.x[i], ohlc.x[endIdx]],
      y: [liquidity.Level[i], liquidity.Level[i]],
      line: { color: "rgba(255, 165, 0, 0.2)" },
      legendgroup: "liquidity",
      name: "Liquidity",
    });
    const midX = ohlc.x[Math.round((i + endIdx) / 2)];
    traces.push({
      type: "scatter",
      mode: "text",
      x: [midX],
      y: [liquidity.Level[i]],
      text: ["Liquidity"],
      textposition: liquidity.Liquidity[i] === 1 ? "top center" : "bottom center",
      textfont: { ...TEXT_FONT, color: "rgba(255, 165, 0, 0.4)" },
      legendgroup: "liquidity",
      name: "Liquidity",
    });
    const swept = liquidity.Swept[i];
    if (swept != null && swept !== 0) {
      const sweptIdx = Math.floor(swept);
      const y2 = liquidity.Liquidity[i] === 1 ? (ohlc.high[sweptIdx] ?? 0) : (ohlc.low[sweptIdx] ?? 0);
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [ohlc.x[endIdx], ohlc.x[sweptIdx]],
        y: [liquidity.Level[i], y2],
        line: { color: "rgba(255, 0, 0, 0.2)" },
        legendgroup: "liquidity",
        name: "Liquidity",
      });
      const midX2 = ohlc.x[Math.round((endIdx + sweptIdx) / 2)];
      const midY2 = ((liquidity.Level[i] ?? 0) + y2) / 2;
      traces.push({
        type: "scatter",
        mode: "text",
        x: [midX2],
        y: [midY2],
        text: ["Liquidity Swept"],
        textposition: liquidity.Liquidity[i] === 1 ? "top center" : "bottom center",
        textfont: { ...TEXT_FONT, color: "rgba(255, 0, 0, 0.4)" },
        legendgroup: "liquidity",
        name: "Liquidity",
      });
    }
  }
  return traces;
}

function addPreviousHighLowTraces(frame: SMCFrame): PlotlyTrace[] {
  const traces: PlotlyTrace[] = [];
  const { previousHighLow, ohlc } = frame;
  const highLevels: number[] = [];
  const highIndexes: number[] = [];
  for (let i = 0; i < previousHighLow.PreviousHigh.length; i++) {
    const v = previousHighLow.PreviousHigh[i];
    if (!isNum(v)) continue;
    if (highLevels.length > 0 && v === highLevels[highLevels.length - 1]) continue;
    highLevels.push(v);
    highIndexes.push(i);
  }
  for (let i = 0; i < highIndexes.length - 1; i++) {
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [ohlc.x[highIndexes[i]!], ohlc.x[highIndexes[i + 1]!]],
      y: [highLevels[i], highLevels[i]],
      line: { color: "rgba(255, 255, 255, 0.2)" },
      legendgroup: "phl",
      name: "PH",
    });
    traces.push({
      type: "scatter",
      mode: "text",
      x: [ohlc.x[highIndexes[i + 1]!]],
      y: [highLevels[i]],
      text: ["PH"],
      textposition: "top center",
      textfont: TEXT_FONT,
      legendgroup: "phl",
      name: "PH",
    });
  }
  const lowLevels: number[] = [];
  const lowIndexes: number[] = [];
  for (let i = 0; i < previousHighLow.PreviousLow.length; i++) {
    const v = previousHighLow.PreviousLow[i];
    if (!isNum(v)) continue;
    if (lowLevels.length > 0 && v === lowLevels[lowLevels.length - 1]) continue;
    lowLevels.push(v);
    lowIndexes.push(i);
  }
  for (let i = 0; i < lowIndexes.length - 1; i++) {
    traces.push({
      type: "scatter",
      mode: "lines",
      x: [ohlc.x[lowIndexes[i]!], ohlc.x[lowIndexes[i + 1]!]],
      y: [lowLevels[i], lowLevels[i]],
      line: { color: "rgba(255, 255, 255, 0.2)" },
      legendgroup: "phl",
      name: "PL",
    });
    traces.push({
      type: "scatter",
      mode: "text",
      x: [ohlc.x[lowIndexes[i + 1]!]],
      y: [lowLevels[i]],
      text: ["PL"],
      textposition: "bottom center",
      textfont: TEXT_FONT,
      legendgroup: "phl",
      name: "PL",
    });
  }
  return traces;
}

const SESSION_COLORS: Record<string, { fill: string; opacity: number }> = {
  asia: { fill: "#1e5f8a", opacity: 0.15 },
  london: { fill: "#16866E", opacity: 0.2 },
  nyam: { fill: "#c47d1a", opacity: 0.15 },
  nypm: { fill: "#6b4a9e", opacity: 0.15 },
};

const SESSION_INDICATOR_MAP: Record<string, "asia" | "london" | "nyam" | "nypm"> = {
  sessionsAsia: "asia",
  sessionsLondon: "london",
  sessionsNYAM: "nyam",
  sessionsNYPM: "nypm",
};

function addSessionShapes(
  ohlc: SMCFrame["ohlc"],
  sessions: { Active: (number | null)[]; High: (number | null)[]; Low: (number | null)[] },
  color: string,
  opacity: number
): PlotlyShape[] {
  const shapes: PlotlyShape[] = [];
  for (let i = 0; i < sessions.Active.length - 1; i++) {
    if (sessions.Active[i] !== 1) continue;
    shapes.push({
      type: "rect",
      x0: ohlc.x[i],
      y0: sessions.Low[i],
      x1: ohlc.x[i + 1],
      y1: sessions.High[i],
      line: { width: 0 },
      fillcolor: color,
      opacity,
    });
  }
  return shapes;
}

function addSessionsShapes(
  frame: SMCFrame,
  visibility: Record<IndicatorId, boolean>
): PlotlyShape[] {
  const { sessions, ohlc } = frame;
  const shapes: PlotlyShape[] = [];

  if ("asia" in sessions && "london" in sessions) {
    for (const [indicatorId, sessionKey] of Object.entries(SESSION_INDICATOR_MAP)) {
      if (!visibility[indicatorId as keyof typeof visibility]) continue;
      const data = sessions[sessionKey];
      const style = SESSION_COLORS[sessionKey];
      if (data && style) shapes.push(...addSessionShapes(ohlc, data, style.fill, style.opacity));
    }
  } else {
    const legacy = sessions as unknown as {
      Active: (number | null)[];
      High: (number | null)[];
      Low: (number | null)[];
    };
    if (visibility.sessionsLondon) {
      shapes.push(
        ...addSessionShapes(ohlc, legacy, SESSION_COLORS.london.fill, SESSION_COLORS.london.opacity)
      );
    }
  }
  return shapes;
}

function addRetracementsAnnotations(frame: SMCFrame): PlotlyAnnotation[] {
  const annotations: PlotlyAnnotation[] = [];
  const { retracements, ohlc } = frame;
  const dir = retracements.Direction;
  const cur = retracements["CurrentRetracement%"];
  const deep = retracements["DeepestRetracement%"];
  const n = dir.length;
  for (let i = 0; i < n; i++) {
    const di = dir[i];
    const nextDi = i < n - 1 ? dir[i + 1] : di;
    if (
      (nextDi !== di || i === n - 1) &&
      di !== 0 &&
      di !== null &&
      nextDi !== 0 &&
      nextDi !== null
    ) {
      const y = di === -1 ? (ohlc.high[i] ?? 0) : (ohlc.low[i] ?? 0);
      const c = cur[i] ?? 0;
      const d = deep[i] ?? 0;
      annotations.push({
        x: ohlc.x[i],
        y,
        xref: "x",
        yref: "y",
        text: `C:${c}%<br>D:${d}%`,
        font: TEXT_FONT,
        showarrow: false,
      });
    }
  }
  return annotations;
}

export function frameToPlotly(
  frame: SMCFrame,
  visibility: Record<IndicatorId, boolean>,
  waveState?: WaveStateRow[] | null
): FramePlotlyResult {
  const data: PlotlyTrace[] = [];
  const shapes: PlotlyShape[] = [];
  const annotations: PlotlyAnnotation[] = [];

  /** Frame with wave_number from API when waveState is provided (same approach as EWO from API). */
  const frameForWave =
    waveState && waveState.length > 0
      ? { ...frame, wave_number: buildWaveNumberForFrame(frame, waveState) }
      : frame;

  if (visibility.candles) {
    data.push(addCandlestickTrace(frame.ohlc));
  }

  if (visibility.sma5 && getSMAValues(frame, "sma5")) {
    const t = addSMATrace(frame, "sma5", "SMA 5", "rgba(100, 220, 140, 0.95)");
    if (t) data.push(t);
  }
  if (visibility.sma35 && getSMAValues(frame, "sma35")) {
    const t = addSMATrace(frame, "sma35", "SMA 35", "rgba(255, 180, 100, 0.95)");
    if (t) data.push(t);
  }

  if (visibility.fvg) {
    const { traces, shapes: s } = addFVGTraces(frame);
    data.push(...traces);
    shapes.push(...s);
  }

  if (visibility.swing) {
    data.push(...addSwingTraces(frame));
  }

  if (visibility.fib) {
    data.push(...addFibTraces(frame));
  }

  if (visibility.bos || visibility.choch) {
    const bosChochTraces = addBosChochTraces(frame);
    for (const t of bosChochTraces) {
      const group = t.legendgroup as string;
      if (group === "bos" && visibility.bos) data.push(t);
      if (group === "choch" && visibility.choch) data.push(t);
    }
  }

  if (visibility.ob) {
    const { shapes: s, annotations: a } = addOBTraces(frame);
    shapes.push(...s);
    annotations.push(...a);
  }

  if (visibility.liquidity) {
    data.push(...addLiquidityTraces(frame));
  }

  if (visibility.phl) {
    data.push(...addPreviousHighLowTraces(frame));
  }

  shapes.push(...addSessionsShapes(frame, visibility));

  if (visibility.retracements) {
    annotations.push(...addRetracementsAnnotations(frame));
  }

  if (visibility.ewo && getEWOValues(frame)) {
    const ewoTrace = addEWOTrace(frame);
    if (ewoTrace) data.push(ewoTrace);
    if (getWaveNumbers(frameForWave)) {
      const w3 = addWaveOverlayTrace(frameForWave, "3", "Wave 3", "rgba(120, 200, 150, 0.95)");
      if (w3) data.push(w3);
      const w4 = addWaveOverlayTrace(frameForWave, "4", "Wave 4", "rgba(200, 190, 120, 0.95)");
      if (w4) data.push(w4);
      const w5 = addWaveOverlayTrace(frameForWave, "5", "Wave 5", "rgba(220, 140, 90, 0.95)");
      if (w5) data.push(w5);
      const waveLabels = addWaveNumberLabelTrace(frameForWave);
      if (waveLabels) data.push(waveLabels);
    }
  }

  const hasEwoPane = visibility.ewo && getEWOValues(frame);
  const layout: FramePlotlyResult["layout"] = {
    ...DARK_LAYOUT,
    shapes,
    annotations,
  };

  if (hasEwoPane) {
    const rowHeightPane2 = 0.20;
    const gap = 0.07;
    const topDomain: [number, number] = [rowHeightPane2 + gap, 1];
    const bottomDomain: [number, number] = [0, rowHeightPane2];
    layout.margin = { l: 10, r: 70, b: 60, t: 10 };
    layout.autosize = false;
    layout.shapes = [
      ...shapes,
      {
        type: "rect",
        xref: "paper",
        yref: "paper",
        x0: 0,
        y0: 0,
        x1: 1,
        y1: rowHeightPane2,
        fillcolor: "rgba(28, 28, 28, 1)",
        line: { width: 0 },
        layer: "below",
      },
      {
        type: "line",
        xref: "paper",
        yref: "paper",
        x0: 0,
        y0: rowHeightPane2,
        x1: 1,
        y1: rowHeightPane2,
        line: { color: "rgba(120, 120, 120, 0.9)", width: 1 },
        layer: "above",
      },
      {
        type: "line",
        xref: "paper",
        yref: "paper",
        x0: 0,
        y0: 0,
        x1: 1,
        y1: 0,
        line: { color: "rgba(120, 120, 120, 0.9)", width: 1 },
        layer: "above",
      },
    ];
    layout.xaxis = {
      ...DARK_LAYOUT.xaxis,
      domain: [0, 1],
      anchor: "y",
    };
    layout.yaxis = {
      ...DARK_LAYOUT.yaxis,
      domain: topDomain,
      anchor: "x",
    };
    layout.xaxis2 = {
      ...EWO_XAXIS2,
      domain: [0, 1],
      anchor: "y2",
    };
    layout.yaxis2 = {
      ...EWO_YAXIS2,
      domain: bottomDomain,
      anchor: "x2",
    };
  }

  return {
    data,
    layout,
  };
}
