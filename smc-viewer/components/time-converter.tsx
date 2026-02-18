"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { easternTimeToUtc, getEasternZoneLabel, utcTimeToEastern } from "@/lib/format-time";

const inputClassName =
  "border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function TimeConverter() {
  const [utcInput, setUtcInput] = useState("");
  const [easternInput, setEasternInput] = useState("");
  const eastern = utcTimeToEastern(utcInput);
  const utc = easternTimeToUtc(easternInput);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-medium text-foreground">
        Time converter ({getEasternZoneLabel()})
      </h3>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="utc-time" className="text-xs text-muted-foreground">
            UTC → Eastern
          </Label>
          <input
            id="utc-time"
            type="text"
            placeholder="07:00"
            value={utcInput}
            onChange={(e) => setUtcInput(e.target.value)}
            className={inputClassName}
          />
          <div className="text-sm">
            <span className="text-muted-foreground">{getEasternZoneLabel()}: </span>
            <span className="font-medium tabular-nums">{eastern ?? "—"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="eastern-time" className="text-xs text-muted-foreground">
            {getEasternZoneLabel()} → UTC (e.g. 2:30 PM)
          </Label>
          <input
            id="eastern-time"
            type="text"
            placeholder="2:30 PM"
            value={easternInput}
            onChange={(e) => setEasternInput(e.target.value)}
            className={inputClassName}
          />
          <div className="text-sm">
            <span className="text-muted-foreground">UTC: </span>
            <span className="font-medium tabular-nums">{utc ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
