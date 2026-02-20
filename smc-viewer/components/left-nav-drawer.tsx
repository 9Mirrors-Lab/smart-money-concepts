"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useChartSettings } from "@/lib/chart-settings-context";
import { IndicatorPanel } from "@/components/indicator-panel";
import { ExportPanel } from "@/components/export-panel";
import { TimeConverter } from "@/components/time-converter";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  Settings2,
  X,
} from "lucide-react";

const MAIN_LINKS = [
  { href: "/smc-viewer", label: "Chart", desc: "SMC animation viewer", icon: LayoutGrid },
] as const;

const ENGINE2_LINKS = [
  { href: "/engine2?tab=reference", label: "Reference", desc: "Logic reference", icon: BookOpen },
  { href: "/engine2?tab=diagnostics", label: "Diagnostics", desc: "Run diagnostics", icon: LayoutDashboard },
  { href: "/engine2?tab=evaluate", label: "Evaluate", desc: "Evaluate runs", icon: ClipboardList },
  { href: "/engine2?tab=tune", label: "Tune", desc: "Calibration", icon: Settings2 },
] as const;

interface LeftNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeftNavDrawer({ open, onOpenChange }: LeftNavDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settings = useChartSettings();

  const isActive = (href: string) => {
    if (href === "/smc-viewer") return pathname === "/smc-viewer";
    if (href.startsWith("/engine2?")) {
      const tab = new URLSearchParams(href.split("?")[1] ?? "").get("tab");
      const currentTab = searchParams.get("tab");
      return pathname === "/engine2" && currentTab === tab;
    }
    return pathname === href || (href !== "/engine2" && pathname.startsWith(href));
  };

  const linkClass = (href: string) =>
    cn(
      "nav-link flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors",
      isActive(href) && "nav-link-active"
    );
  const descClass = (href: string) =>
    cn("nav-link-desc text-xs", !isActive(href) && "text-muted-foreground");

  return (
    <DrawerContent direction="left" showOverlay={false} className="nav-drawer-panel flex h-full max-h-full flex-col">
      <DrawerTitle className="sr-only">Navigation</DrawerTitle>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-end border-b border-[var(--nav-drawer-border)]/30 p-2">
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--nav-drawer-active-text)] hover:bg-[var(--nav-drawer-hover-bg)]" aria-label="Close navigation">
              <X className="size-4" />
            </Button>
          </DrawerClose>
        </div>
        <ScrollArea className="flex-1">
          <Accordion type="multiple" defaultValue={["main", "engine2", "settings"]} className="w-full px-2">
            <AccordionItem value="main" className="border-[var(--nav-drawer-border)]/20">
              <AccordionTrigger className="py-3 text-sm font-medium text-[var(--nav-drawer-active-text)]">Main</AccordionTrigger>
              <AccordionContent className="pb-2">
                <ul className="flex flex-col gap-0.5">
                  {MAIN_LINKS.map(({ href, label, desc, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className={linkClass(href)}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <span className={descClass(href)}>{desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="engine2" className="border-[var(--nav-drawer-border)]/20">
              <AccordionTrigger className="py-3 text-sm font-medium text-[var(--nav-drawer-active-text)]">Engine 2</AccordionTrigger>
              <AccordionContent className="pb-2">
                <ul className="flex flex-col gap-0.5">
                  {ENGINE2_LINKS.map(({ href, label, desc, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className={linkClass(href)}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <span className={descClass(href)}>{desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="settings" className="border-[var(--nav-drawer-border)]/20">
              <AccordionTrigger className="py-3 text-sm font-medium text-[var(--nav-drawer-active-text)]">Settings</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Indicators</p>
                  <IndicatorPanel
                    visibility={settings.indicatorVisibility}
                    onToggle={settings.toggleIndicator}
                    onCandlesOnly={settings.setCandlesOnly}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">DB Export</p>
                  <ExportPanel
                    symbol={settings.chartMeta?.symbol ?? ""}
                    currentTimeframe={settings.chartMeta?.timeframe ?? "23"}
                    onExportSuccess={settings.onChartRefresh ?? undefined}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Time conversion</p>
                  <TimeConverter />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Square chart</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Set Y-axis to a swing low and swing high so the chart frames that range.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="nav-square-low" className="text-xs text-muted-foreground">
                      Swing low
                    </Label>
                    <input
                      id="nav-square-low"
                      type="number"
                      step="any"
                      placeholder="e.g. 3200"
                      value={settings.swingLowInput}
                      onChange={(e) => settings.setSwingLowInput(e.target.value)}
                      className="border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="nav-square-high" className="text-xs text-muted-foreground">
                      Swing high
                    </Label>
                    <input
                      id="nav-square-high"
                      type="number"
                      step="any"
                      placeholder="e.g. 3400"
                      value={settings.swingHighInput}
                      onChange={(e) => settings.setSwingHighInput(e.target.value)}
                      className="border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" onClick={settings.handleSquareChart}>
                      Square chart
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={settings.handleClearSquare}>
                      Clear
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <Checkbox
                      id="nav-square-log-scale"
                      checked={settings.logScale}
                      onCheckedChange={(c) => settings.setLogScale(c === true)}
                    />
                    <Label htmlFor="nav-square-log-scale" className="cursor-pointer text-sm font-normal">
                      Log scale (Y-axis)
                    </Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </div>
    </DrawerContent>
  );
}
