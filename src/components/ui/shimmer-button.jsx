import { cn } from "../../lib/utils";

export function ShimmerButton({
  children,
  className,
  as: Component = "button",
  ...props
}) {
  return (
    <Component className={cn("shimmer-btn", className)} {...props}>
      <span className="shimmer-btn-shine absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent" />
      <span className="shimmer-btn-content">{children}</span>
    </Component>
  );
}
