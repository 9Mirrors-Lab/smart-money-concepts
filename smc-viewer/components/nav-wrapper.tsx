"use client";

import { Suspense, useState } from "react";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { LeftNavDrawer } from "@/components/left-nav-drawer";
import { GratitudeDrawer, GratitudeRibbon } from "@/components/gratitude-drawer";
import { Button } from "@/components/ui/button";
import { Infinity } from "lucide-react";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [gratitudeOpen, setGratitudeOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 left-0 z-40">
        <Drawer direction="left" open={navOpen} onOpenChange={setNavOpen}>
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
      <div className="fixed bottom-24 right-0 z-40">
        <GratitudeDrawer
          open={gratitudeOpen}
          onOpenChange={setGratitudeOpen}
          trigger={
            <GratitudeRibbon open={gratitudeOpen} onOpenChange={setGratitudeOpen} />
          }
        />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}
