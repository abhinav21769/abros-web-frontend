import { useMotionTemplate, useMotionValue, motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function SpotlightCard({ children, className }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(380px circle at ${mouseX}px ${mouseY}px, rgba(99, 102, 241, 0.12), transparent 75%)`;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[12px] border border-[#e8ebf2] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)]",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
