"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

const NAV_BAR_CLASS =
  "sticky top-0 z-50 flex shrink-0 border-b border-border bg-background/95 backdrop-blur";

export function ChartNavBar({
  rightContent,
  expanded = false,
  onExpandedChange,
}: {
  rightContent: React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const isCollapsible = onExpandedChange != null;

  return (
    <nav className={NAV_BAR_CLASS} aria-label="Chart toolbar">
      {isCollapsible && !expanded ? (
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
          aria-expanded="false"
          aria-label="Expand chart toolbar"
        >
          <span>Timeframe · Jump</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex-1 min-w-0" />
          <div className="flex flex-wrap items-center gap-2 gap-y-1 md:gap-4">
            {rightContent}
            {isCollapsible && (
              <button
                type="button"
                onClick={() => onExpandedChange(false)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Collapse chart toolbar"
              >
                <ChevronUp className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
