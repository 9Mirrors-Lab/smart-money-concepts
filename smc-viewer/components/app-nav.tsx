"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, ChevronDown, ClipboardList, LayoutDashboard, BookOpen, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ENGINE2_LINKS = [
  { href: "/smc-viewer?open=all-timeframes", label: "All timeframes", icon: LayoutGrid },
  { href: "/engine2-checklist", label: "Diagnostic checklist", icon: ClipboardList },
  { href: "/engine2-scorecard", label: "Diagnostic scorecard", icon: LayoutDashboard },
  { href: "/engine2-logic-inventory", label: "Logic inventory", icon: BookOpen },
  { href: "/engine2-tune", label: "Engine 2 tune", icon: Settings2 },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const isChartActive = pathname === "/smc-viewer";
  const isEngine2Active = pathname.startsWith("/engine2-");

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <Link
        href="/smc-viewer"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isChartActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
        Chart
      </Link>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 px-2.5 py-1.5 text-sm font-medium",
              isEngine2Active
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            Engine2
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="flex flex-col gap-0.5 p-2">
            <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">
              Engine2
            </p>
            {ENGINE2_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm font-normal hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const NAV_BAR_CLASS =
  "sticky top-0 z-50 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur";

export function AppNav() {
  return (
    <nav className={NAV_BAR_CLASS} aria-label="Main">
      <NavLinks />
    </nav>
  );
}

export function ChartNavBar({
  rightContent,
}: {
  rightContent: React.ReactNode;
}) {
  return (
    <nav className={NAV_BAR_CLASS} aria-label="Main">
      <NavLinks />
      <div className="flex flex-wrap items-center gap-2 gap-y-1 md:gap-4">
        {rightContent}
      </div>
    </nav>
  );
}
