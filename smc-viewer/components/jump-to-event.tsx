"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SMCFrame } from "@/lib/smc-types";

export interface JumpToEventProps {
  frames: SMCFrame[];
  currentFrame: number;
  onJump: (frameIndex: number) => void;
  disabled?: boolean;
}

interface EventOption {
  label: string;
  frameIndex: number;
}

function isNum(v: number | null): v is number {
  return v !== null && !Number.isNaN(v);
}

export function JumpToEvent({ frames, currentFrame, onJump, disabled }: JumpToEventProps) {
  const options = getEventOptions(frames);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Jump to</span>
      <Select
        value={options.some((o) => o.frameIndex === currentFrame) ? currentFrame.toString() : ""}
        onValueChange={(v) => {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n)) onJump(n);
        }}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Event..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={`${opt.label}-${opt.frameIndex}`} value={opt.frameIndex.toString()}>
              {opt.label} (frame {opt.frameIndex + 1})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getEventOptions(frames: SMCFrame[]): EventOption[] {
  const options: EventOption[] = [];
  let firstBOS: number | null = null;
  let lastBOS: number | null = null;
  let firstCHoCH: number | null = null;
  let lastCHoCH: number | null = null;
  let firstFVG: number | null = null;
  let lastFVG: number | null = null;
  let firstSweep: number | null = null;
  let lastSweep: number | null = null;
  let firstOB: number | null = null;
  let lastOB: number | null = null;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    for (let j = 0; j < f.bosChoch.BOS.length; j++) {
      if (isNum(f.bosChoch.BOS[j])) {
        if (firstBOS === null) firstBOS = i;
        lastBOS = i;
        break;
      }
    }
    for (let j = 0; j < f.bosChoch.CHOCH.length; j++) {
      if (isNum(f.bosChoch.CHOCH[j])) {
        if (firstCHoCH === null) firstCHoCH = i;
        lastCHoCH = i;
        break;
      }
    }
    for (let j = 0; j < f.fvg.FVG.length; j++) {
      if (isNum(f.fvg.FVG[j])) {
        if (firstFVG === null) firstFVG = i;
        lastFVG = i;
        break;
      }
    }
    for (let j = 0; j < f.liquidity.Swept.length; j++) {
      const s = f.liquidity.Swept[j];
      if (s != null && s !== 0) {
        if (firstSweep === null) firstSweep = i;
        lastSweep = i;
        break;
      }
    }
    for (let j = 0; j < f.ob.OB.length; j++) {
      if (f.ob.OB[j] === 1 || f.ob.OB[j] === -1) {
        if (firstOB === null) firstOB = i;
        lastOB = i;
        break;
      }
    }
  }

  if (firstBOS !== null) options.push({ label: "First BOS", frameIndex: firstBOS });
  if (lastBOS !== null && lastBOS !== firstBOS)
    options.push({ label: "Last BOS", frameIndex: lastBOS });
  if (firstCHoCH !== null) options.push({ label: "First CHoCH", frameIndex: firstCHoCH });
  if (lastCHoCH !== null && lastCHoCH !== firstCHoCH)
    options.push({ label: "Last CHoCH", frameIndex: lastCHoCH });
  if (firstFVG !== null) options.push({ label: "First FVG", frameIndex: firstFVG });
  if (lastFVG !== null && lastFVG !== firstFVG)
    options.push({ label: "Last FVG", frameIndex: lastFVG });
  if (firstSweep !== null)
    options.push({ label: "First liquidity sweep", frameIndex: firstSweep });
  if (lastSweep !== null && lastSweep !== firstSweep)
    options.push({ label: "Last liquidity sweep", frameIndex: lastSweep });
  if (firstOB !== null) options.push({ label: "First OB", frameIndex: firstOB });
  if (lastOB !== null && lastOB !== firstOB)
    options.push({ label: "Last OB", frameIndex: lastOB });

  return options;
}
