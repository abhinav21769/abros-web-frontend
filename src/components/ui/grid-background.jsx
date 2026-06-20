import { cn } from "../../lib/utils";

export function GridBackground({ className, children }) {
  return (
    <div className={cn("relative min-h-full w-full", className)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          "bg-size-[34px_34px]",
          "bg-[linear-gradient(to_right,#e2e6f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e6f0_1px,transparent_1px)]"
        )}
      />
      <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[#f6f7fb] mask-[radial-gradient(ellipse_at_top,transparent_25%,black)]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
