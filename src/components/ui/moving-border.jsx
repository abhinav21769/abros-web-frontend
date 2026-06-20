import { cn } from "../../lib/utils";

export function MovingBorder({
  children,
  className,
  containerClassName,
  borderClassName,
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] p-px",
        containerClassName
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[10px]">
        <div
          className={cn(
            "absolute inset-[-200%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#8b5cf6_15%,#6366f1_25%,transparent_45%,transparent_100%)]",
            borderClassName
          )}
        />
      </div>
      <div
        className={cn(
          "relative rounded-[9px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
