"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Engine2LogicInventoryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/engine2?tab=reference");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Redirecting to Engine 2 hub…
    </div>
  );
}
