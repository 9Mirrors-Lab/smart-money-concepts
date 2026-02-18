"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inputClassName =
  "border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

const TIMEFRAME_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "23", label: "23m" },
  { value: "90", label: "90m" },
  { value: "360", label: "360m" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "all", label: "All (23, 90, 360, 1D, 1W, 1M)" },
] as const;

export interface ExportPanelProps {
  symbol: string;
  currentTimeframe: string;
  onExportSuccess?: () => void;
}

export function ExportPanel({
  symbol,
  currentTimeframe,
  onExportSuccess,
}: ExportPanelProps) {
  const [last, setLast] = useState(500);
  const [windowSize, setWindowSize] = useState(100);
  const [timeframe, setTimeframe] = useState<string>("current");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleRun = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const tf = timeframe === "current" ? currentTimeframe : timeframe;
      const allTimeframes = timeframe === "all";
      const res = await fetch("/api/export-smc-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe: allTimeframes ? "23" : tf,
          allTimeframes,
          last,
          window: windowSize,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.detail ?? data.error ?? `Export failed (${res.status})`,
        });
        return;
      }
      setMessage({ type: "ok", text: data.message ?? "Export finished." });
      onExportSuccess?.();
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Export failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-medium text-foreground">Export to DB</h3>
      <p className="text-xs text-muted-foreground">
        Run the script to update <code className="rounded bg-muted px-1">smc_results</code> (used by Live API).
      </p>
      <div className="space-y-2">
        <Label htmlFor="export-last" className="text-xs text-muted-foreground">
          Records (last N bars)
        </Label>
        <input
          id="export-last"
          type="number"
          min={100}
          max={10000}
          value={last}
          onChange={(e) => setLast(Math.min(10000, Math.max(100, Number(e.target.value) || 500)))}
          className={inputClassName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="export-window" className="text-xs text-muted-foreground">
          Window (bars per frame)
        </Label>
        <input
          id="export-window"
          type="number"
          min={50}
          max={500}
          value={windowSize}
          onChange={(e) => setWindowSize(Math.min(500, Math.max(50, Number(e.target.value) || 100)))}
          className={inputClassName}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Timeframe</Label>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        onClick={handleRun}
        disabled={loading}
        size="sm"
        className="w-full"
      >
        {loading ? "Running…" : "Run export"}
      </Button>
      {message && (
        <p
          className={`text-xs ${message.type === "ok" ? "text-muted-foreground" : "text-destructive"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
