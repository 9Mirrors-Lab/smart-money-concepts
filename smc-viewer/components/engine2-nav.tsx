"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const ENGINE2_NAV_LINKS = [
  { href: "/engine2-logic-inventory", label: "Logic inventory" },
  { href: "/engine2-diagnostic-flow", label: "Diagnostic flow" },
  { href: "/engine2-checklist", label: "Checklist" },
  { href: "/engine2-scorecard", label: "Scorecard" },
  { href: "/engine2-tune", label: "Tune" },
] as const;

export function Engine2Nav() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ENGINE2_NAV_LINKS.map(({ href, label }) => (
        <Link key={href} href={href}>
          <Button variant="outline" size="sm">
            {label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
