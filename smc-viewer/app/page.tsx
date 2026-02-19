import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-8">
      <h1 className="text-2xl font-semibold text-foreground">SMC Viewer</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Chart animation and Engine 2 diagnostics. Use the nav above to open the chart or any Engine 2 page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/smc-viewer"
          className="rounded-lg border border-border bg-card px-6 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Open chart
        </Link>
        <Link
          href="/engine2-diagnostic-flow"
          className="rounded-lg border border-border bg-card px-6 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Engine 2 diagnostic flow
        </Link>
      </div>
    </div>
  );
}
