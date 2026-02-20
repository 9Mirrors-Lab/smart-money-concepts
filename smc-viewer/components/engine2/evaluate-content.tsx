"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Engine2ChecklistContent } from "@/app/engine2-checklist/page";
import { Engine2ScorecardContent } from "@/app/engine2-scorecard/page";

export function Engine2EvaluateContent() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col md:flex-row">
      <ResizablePanelGroup
        orientation="horizontal"
        className="hidden md:flex md:min-h-[60vh]"
      >
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full">
            <div className="w-full max-w-4xl px-4 py-6" id="checklist">
              <h2 className="mb-4 text-base font-semibold">Checklist</h2>
              <Engine2ChecklistContent />
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full">
            <div className="w-full max-w-4xl px-4 py-6" id="scorecard">
              <h2 className="mb-4 text-base font-semibold">Scorecard</h2>
              <Engine2ScorecardContent />
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
      {/* Single column on small screens */}
      <div className="flex flex-col gap-8 px-4 py-6 md:hidden">
        <section id="checklist">
          <h2 className="mb-4 text-base font-semibold">Checklist</h2>
          <Engine2ChecklistContent />
        </section>
        <section id="scorecard">
          <h2 className="mb-4 text-base font-semibold">Scorecard</h2>
          <Engine2ScorecardContent />
        </section>
      </div>
    </div>
  );
}
