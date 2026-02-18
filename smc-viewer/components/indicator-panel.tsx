"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { IndicatorId } from "@/lib/smc-types";
import {
  INDICATOR_IDS,
  INDICATOR_LABELS,
  SESSION_INDICATOR_IDS,
} from "@/lib/smc-types";

export interface IndicatorPanelProps {
  visibility: Record<IndicatorId, boolean>;
  onToggle: (id: IndicatorId) => void;
  onCandlesOnly?: () => void;
}

const SESSION_IDS_SET = new Set<string>(SESSION_INDICATOR_IDS);
const NON_SESSION_IDS = INDICATOR_IDS.filter((id) => !SESSION_IDS_SET.has(id));

export function IndicatorPanel({ visibility, onToggle, onCandlesOnly }: IndicatorPanelProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Indicators</h3>
        {onCandlesOnly && (
          <button
            type="button"
            onClick={onCandlesOnly}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Candles only
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {NON_SESSION_IDS.map((id) => (
          <div key={id} className="flex items-center space-x-2">
            <Checkbox
              id={id}
              checked={visibility[id]}
              onCheckedChange={() => onToggle(id)}
            />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
              {INDICATOR_LABELS[id]}
            </Label>
          </div>
        ))}
        <div className="border-t border-border pt-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Sessions
          </p>
          <div className="flex flex-col gap-1.5 pl-1">
            {SESSION_INDICATOR_IDS.map((id) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={id}
                  checked={visibility[id]}
                  onCheckedChange={() => onToggle(id)}
                />
                <Label
                  htmlFor={id}
                  className="cursor-pointer text-sm font-normal"
                >
                  {INDICATOR_LABELS[id]}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
