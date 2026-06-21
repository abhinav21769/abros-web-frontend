import { useLottie } from "lottie-react";
import BrandLogo from "../BrandLogo";
import brandLoaderAnimation from "../../assets/lottie/brand-loader.json";

export default function LottieLoader({
  message,
  fullScreen = false,
  compact = false,
  logoSize,
}) {
  const resolvedLogoSize = logoSize ?? (compact ? 40 : 56);
  const ringSize = compact ? 96 : 128;

  const { View } = useLottie({
    animationData: brandLoaderAnimation,
    loop: true,
  });

  return (
    <div
      className={`lottie-loader${fullScreen ? " lottie-loader-fullscreen" : ""}${compact ? " lottie-loader-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="lottie-loader-visual"
        style={{ width: ringSize, height: ringSize }}
      >
        <div className="lottie-loader-ring">{View}</div>
        <BrandLogo size={resolvedLogoSize} className="lottie-loader-logo" />
      </div>
      {message ? <p className="lottie-loader-message">{message}</p> : null}
    </div>
  );
}
