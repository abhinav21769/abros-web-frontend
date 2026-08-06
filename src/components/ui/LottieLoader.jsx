export default function LottieLoader({
  message,
  fullScreen = false,
  compact = false,
}) {
  return (
    <div
      className={`lottie-loader${fullScreen ? " lottie-loader-fullscreen" : ""}${compact ? " lottie-loader-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="spinner-ring" />
      {message ? <p className="lottie-loader-message">{message}</p> : null}
    </div>
  );
}
