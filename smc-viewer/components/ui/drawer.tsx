"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

const Drawer = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;
const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> {
  /** When false, no overlay is rendered; chart/background stays interactive. */
  showOverlay?: boolean;
  /** When "bottom", positions drawer at bottom of viewport (slide up). */
  direction?: "right" | "left" | "top" | "bottom";
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  DrawerContentProps
>(({ className, children, showOverlay = true, direction, ...props }, ref) => (
  <DrawerPortal>
    {showOverlay && <DrawerOverlay />}
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col border-border bg-background shadow-lg",
        direction === "bottom"
          ? "inset-x-0 bottom-0 top-auto max-h-[95vh] rounded-t-xl border-t border-l border-r"
          : direction === "top"
            ? "inset-x-0 top-0 bottom-auto max-h-[40vh] rounded-b-xl border-b border-l border-r"
            : direction === "left"
              ? "inset-y-0 left-0 h-full w-[min(320px,85vw)] border-r"
              : "inset-y-0 right-0 h-full border-l",
        "data-[vaul-drawer-direction=right]:data-[state=open]:animate-in data-[vaul-drawer-direction=right]:data-[state=closed]:animate-out",
        "data-[vaul-drawer-direction=right]:data-[state=closed]:slide-out-to-right data-[vaul-drawer-direction=right]:data-[state=open]:slide-in-from-right",
        "data-[vaul-drawer-direction=left]:data-[state=open]:animate-in data-[vaul-drawer-direction=left]:data-[state=closed]:animate-out",
        "data-[vaul-drawer-direction=left]:data-[state=closed]:slide-out-to-left data-[vaul-drawer-direction=left]:data-[state=open]:slide-in-from-left",
        "data-[vaul-drawer-direction=top]:data-[state=open]:animate-in data-[vaul-drawer-direction=top]:data-[state=closed]:animate-out",
        "data-[vaul-drawer-direction=top]:data-[state=closed]:slide-out-to-top data-[vaul-drawer-direction=top]:data-[state=open]:slide-in-from-top",
        "data-[vaul-drawer-direction=bottom]:data-[state=open]:animate-in data-[vaul-drawer-direction=bottom]:data-[state=closed]:animate-out",
        "data-[vaul-drawer-direction=bottom]:data-[state=closed]:slide-out-to-bottom data-[vaul-drawer-direction=bottom]:data-[state=open]:slide-in-from-bottom",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 p-4 text-left",
      className
    )}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
