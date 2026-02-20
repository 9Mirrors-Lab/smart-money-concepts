"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const ENGINE2_NAV_LINKS: { href: string; label: string }[] = [];

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
