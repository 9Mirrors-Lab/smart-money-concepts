"use client";

import { PinOff, Pin } from "lucide-react";
import type { IndicatorId } from "@/lib/smc-types";
import { INDICATOR_LABELS, SESSION_INDICATOR_IDS } from "@/lib/smc-types";
import { cn } from "@/lib/utils";

export interface IndicatorPanelProps {
  visibility: Record<IndicatorId, boolean>;
  onToggle: (id: IndicatorId) => void;
  onCandlesOnly?: () => void;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
}

const LEFT_COLUMN: IndicatorId[] = ["candles", "swing", "bos", "choch", "ob", "liquidity"];
const RIGHT_COLUMN: IndicatorId[] = ["fvg", "fib", "phl", "retracements", "ewo", "sma5", "sma35", "box"];

const PILL_WIDTH = "7.25rem";

function TogglePill({
  id,
  label,
  checked,
  onToggle,
  style,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={style}
      className={cn(
        "indicator-pill flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 indicator-pill-fixed",
        checked ? "indicator-pill-on" : "indicator-pill-off",
      )}
    >
      <span
        className={cn(
          "indicator-dot shrink-0 rounded-full transition-all duration-200",
          checked ? "indicator-dot-on" : "indicator-dot-off"
        )}
        aria-hidden
      />
      <span className="indicator-label min-w-0 truncate text-[0.8125rem] font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}

function GroupBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="indicator-group flex flex-col gap-2">
      <h4 className="indicator-group-title">{title}</h4>
      <div className="indicator-group-list flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export function IndicatorPanel({
  visibility,
  onToggle,
  onCandlesOnly,
  pinned = true,
  onPinChange,
}: IndicatorPanelProps) {
  return (
    <div className="indicator-panel flex flex-col gap-5">
      {onPinChange && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onPinChange(!pinned)}
            className={cn(
              "indicator-pin-btn flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] font-medium transition-all duration-200",
              pinned
                ? "text-[var(--menu-muted)] hover:text-[var(--menu-text)] hover:bg-[var(--menu-surface-hover)]"
                : "text-[var(--ind-toolbar-accent,oklch(0.7_0.18_200))] bg-[var(--ind-toolbar-accent,oklch(0.7_0.18_200))/0.12] hover:bg-[var(--ind-toolbar-accent,oklch(0.7_0.18_200))/0.2]"
            )}
            title={pinned ? "Unpin — float as toolbar on chart" : "Pin back to menu"}
          >
            {pinned ? (
              <>
                <PinOff className="size-3.5" aria-hidden />
                Unpin
              </>
            ) : (
              <>
                <Pin className="size-3.5" aria-hidden />
                Pin to menu
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex gap-x-6">
        <GroupBlock title="Structure">
          {LEFT_COLUMN.map((id) => (
            <TogglePill
              key={id}
              id={`ind-${id}`}
              label={INDICATOR_LABELS[id]}
              checked={visibility[id]}
              onToggle={() => onToggle(id)}
              style={{ width: PILL_WIDTH, minWidth: PILL_WIDTH, maxWidth: PILL_WIDTH }}
            />
          ))}
          {onCandlesOnly && (
            <button
              type="button"
              onClick={onCandlesOnly}
              className="indicator-pill flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 indicator-pill-off indicator-pill-fixed"
              style={{ width: PILL_WIDTH, minWidth: PILL_WIDTH, maxWidth: PILL_WIDTH }}
            >
              <span className="indicator-dot shrink-0 rounded-full transition-all duration-200 indicator-dot-off opacity-0" aria-hidden />
              <span className="indicator-label min-w-0 truncate text-[0.8125rem] font-medium leading-tight text-[var(--menu-muted)]">
                No Ind
              </span>
            </button>
          )}
        </GroupBlock>
        <GroupBlock title="Overlays">
          {RIGHT_COLUMN.map((id) => (
            <TogglePill
              key={id}
              id={`ind-${id}`}
              label={INDICATOR_LABELS[id]}
              checked={visibility[id]}
              onToggle={() => onToggle(id)}
              style={{ width: PILL_WIDTH, minWidth: PILL_WIDTH, maxWidth: PILL_WIDTH }}
            />
          ))}
        </GroupBlock>
      </div>

      <div className="indicator-sessions flex flex-col gap-2 pt-1">
        <h4 className="indicator-group-title">Sessions</h4>
        <div className="flex gap-x-6">
          <div className="flex flex-col gap-1.5">
            {[SESSION_INDICATOR_IDS[0], SESSION_INDICATOR_IDS[2]].map((id) => (
              <TogglePill
                key={id}
                id={`ind-${id}`}
                label={INDICATOR_LABELS[id]}
                checked={visibility[id]}
                onToggle={() => onToggle(id)}
                style={{ width: PILL_WIDTH, minWidth: PILL_WIDTH, maxWidth: PILL_WIDTH }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {[SESSION_INDICATOR_IDS[1], SESSION_INDICATOR_IDS[3]].map((id) => (
              <TogglePill
                key={id}
                id={`ind-${id}`}
                label={INDICATOR_LABELS[id]}
                checked={visibility[id]}
                onToggle={() => onToggle(id)}
                style={{ width: PILL_WIDTH, minWidth: PILL_WIDTH, maxWidth: PILL_WIDTH }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
