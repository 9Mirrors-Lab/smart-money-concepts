"use client";

import { Suspense, useState } from "react";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { LeftNavDrawer } from "@/components/left-nav-drawer";
import { GratitudeDrawer, GratitudeRibbon } from "@/components/gratitude-drawer";
import { CalculatorDrawer, CalculatorRibbon } from "@/components/calculator-drawer";
import { FloatingIndicatorToolbar } from "@/components/floating-indicator-toolbar";
import { useChartSettings } from "@/lib/chart-settings-context";
import { Button } from "@/components/ui/button";
import { Infinity } from "lucide-react";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [gratitudeOpen, setGratitudeOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const settings = useChartSettings();

  return (
    <>
      {/* Transparent backdrop — closes nav when tapping outside, z-index below nav (z-40) */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      )}
      <div className="fixed bottom-24 left-0 z-40">
        <Drawer direction="left" open={navOpen} onOpenChange={setNavOpen} modal={false}>
          <DrawerTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="nav-tab-trigger nav-tab-trigger-left h-10 w-10 rounded-r-md rounded-l-none border border-l-0 p-0"
              title="Open navigation"
              aria-label="Open navigation"
            >
              <Infinity className="size-4 shrink-0" aria-hidden />
            </Button>
          </DrawerTrigger>
          <Suspense fallback={null}>
            <LeftNavDrawer open={navOpen} onOpenChange={setNavOpen} />
          </Suspense>
        </Drawer>
      </div>
      <div className="fixed bottom-24 right-0 z-40 flex flex-col gap-2">
        <CalculatorRibbon open={calculatorOpen} onOpenChange={setCalculatorOpen} />
        <GratitudeDrawer
          open={gratitudeOpen}
          onOpenChange={setGratitudeOpen}
          trigger={
            <GratitudeRibbon open={gratitudeOpen} onOpenChange={setGratitudeOpen} />
          }
        />
      </div>
      <CalculatorDrawer open={calculatorOpen} onOpenChange={setCalculatorOpen} />
      {!settings.indicatorsPinned && (
        <FloatingIndicatorToolbar
          visibility={settings.indicatorVisibility}
          onToggle={settings.toggleIndicator}
          onCandlesOnly={settings.setCandlesOnly}
          onPin={() => settings.setIndicatorsPinned(true)}
          opacity={settings.indicatorOpacity}
          onOpacityChange={settings.setIndicatorOpacity}
        />
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}
