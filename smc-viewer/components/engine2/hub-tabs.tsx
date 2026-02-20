"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const ENGINE2_TABS = [
  { value: "reference", label: "Reference" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "evaluate", label: "Evaluate" },
  { value: "tune", label: "Tune" },
] as const;

export type Engine2TabValue = (typeof ENGINE2_TABS)[number]["value"];

export function Engine2HubTabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: Engine2TabValue;
  onValueChange?: (v: Engine2TabValue) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange?.(v as Engine2TabValue)}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
        {ENGINE2_TABS.map((tab) => {
          const href = `/engine2?tab=${tab.value}`;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              asChild
              className={cn(
                "rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:shadow-none"
              )}
            >
              <Link href={href} replace scroll={false}>
                {tab.label}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}
