import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <h1 className="text-2xl font-semibold text-foreground">SMC Viewer</h1>
      <Link
        href="/smc-viewer"
        className="rounded-lg border border-border bg-card px-6 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Open SMC Animation Viewer
      </Link>
    </div>
  );
}
