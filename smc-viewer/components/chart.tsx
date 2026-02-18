"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlotlyTrace } from "@/lib/frame-to-plotly";

interface PlotlyComponentProps {
  data: PlotlyTrace[];
  layout: Record<string, unknown>;
  config?: Record<string, unknown>;
  useResizeHandler?: boolean;
  style?: React.CSSProperties;
}

const Plot = dynamic(
  () =>
    Promise.all([
      import("react-plotly.js/factory"),
      import("plotly.js-dist-min"),
    ]).then(([factory, Plotly]) => (factory as { default: (p: unknown) => ComponentType<PlotlyComponentProps> }).default(Plotly.default)),
  { ssr: false }
) as ComponentType<PlotlyComponentProps>;

export interface SMCChartProps {
  data: PlotlyTrace[];
  /** Full layout from frameToPlotly (includes shapes, annotations, and when EWO enabled: xaxis/yaxis domains, xaxis2, yaxis2 for second pane). */
  layout: Record<string, unknown>;
  width?: number;
  height?: number;
  /** When set, fix Y-axis to [low, high] (square chart between swing low/high). */
  yRange?: [number, number] | null;
  /** Y-axis scale: "linear" or "log". */
  yAxisType?: "linear" | "log";
}

const defaultLayout = {
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

export function SMCChart({
  data,
  layout: baseLayout,
  width,
  height,
  yRange,
  yAxisType = "linear",
}: SMCChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 450 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) {
        setSize({ width: clientWidth, height: clientHeight });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const baseY = (baseLayout.yaxis ?? defaultLayout.yaxis) as Record<string, unknown>;
    const baseAutosize = baseLayout.autosize as boolean | undefined;
    const baseMargin = baseLayout.margin as Record<string, number> | undefined;
    const hasSecondPane = baseLayout.xaxis2 != null && baseLayout.yaxis2 != null;
    const merged: Record<string, unknown> = {
      ...defaultLayout,
      ...baseLayout,
      width: width ?? size.width,
      height: height ?? size.height,
      autosize: hasSecondPane ? false : (baseAutosize !== undefined ? baseAutosize : true),
      ...(baseMargin ? { margin: baseMargin } : {}),
      yaxis: {
        ...baseY,
        type: yAxisType,
        ...(yRange && yRange[0] !== yRange[1]
          ? { range: [yRange[0], yRange[1]] as [number, number] }
          : {}),
      },
    };
    if (hasSecondPane) {
      merged.xaxis2 = baseLayout.xaxis2;
      merged.yaxis2 = baseLayout.yaxis2;
      if (baseLayout.shapes != null) merged.shapes = baseLayout.shapes;
    }
    return merged;
  }, [baseLayout, width, height, size.width, size.height, yRange, yAxisType]);

  return (
    <div
      ref={containerRef}
      className="min-h-0 w-full flex-1"
      style={{ minHeight: 400 }}
    >
      <Plot
        data={data}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%", minHeight: "400px" }}
      />
    </div>
  );
}
