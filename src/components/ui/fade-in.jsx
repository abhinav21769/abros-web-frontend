import { motion } from "framer-motion";

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.4,
  y = 12,
  style,
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
