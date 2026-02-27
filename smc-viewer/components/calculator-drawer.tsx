"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calculator, X } from "lucide-react";
import { ElliottGannCalculator } from "@/components/elliott-gann-calculator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";

interface CalculatorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalculatorRibbon({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={() => onOpenChange(!open)}
      title="Elliott / Gann Calculator"
      aria-label="Open calculator"
      className="calculator-ribbon nav-tab-trigger nav-tab-trigger-right-full flex h-10 w-10 shrink-0 items-center justify-center rounded-l-md rounded-r-none border border-r-0 p-0"
    >
      <Calculator className="size-4 shrink-0" aria-hidden />
    </Button>
  );
}

export function CalculatorDrawer({ open, onOpenChange }: CalculatorDrawerProps) {
  return (
    <Drawer
      direction="right"
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
    >
      <DrawerContent
        direction="right"
        showOverlay={false}
        className="calculator-drawer calculator-drawer-bg inset-y-0 left-auto right-0 top-0 h-full max-h-full w-[min(380px,92vw)] rounded-l-xl border-0 shadow-[-8px_0_32px_0_rgba(0,0,0,0.4)]"
      >
        <DrawerTitle className="sr-only">Elliott / Gann Calculator</DrawerTitle>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Ambient background */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-[400px] overflow-hidden" aria-hidden>
            <DottedGlowBackground
              className="menu-glow-fade"
              opacity={0.6}
              gap={5}
              radius={1.0}
              colorLightVar="--color-neutral-100"
              glowColorLightVar="--color-neutral-700"
              colorDarkVar="--color-neutral-600"
              glowColorDarkVar="--color-sky-900"
              backgroundOpacity={0}
              speedMin={0.05}
              speedMax={0.3}
              speedScale={0.25}
            />
          </div>

          {/* Header */}
          <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-[var(--menu-muted)]" aria-hidden />
              <span className="text-sm font-medium text-[var(--menu-text)]">Elliott / Gann</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--menu-muted)] transition-colors hover:bg-[var(--menu-surface-hover)] hover:text-[var(--menu-text)]"
              aria-label="Close calculator"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="relative z-10 min-h-0 flex-1">
            <div className="px-4 py-4">
              <ElliottGannCalculator />
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
