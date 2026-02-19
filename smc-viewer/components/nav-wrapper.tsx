"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChartPage = pathname === "/smc-viewer";

  return (
    <>
      {!isChartPage && <AppNav />}
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}
