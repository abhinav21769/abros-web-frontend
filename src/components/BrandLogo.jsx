const LOGO_SRC = "/logo.jpg";

export default function BrandLogo({ size = 40, className = "" }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Abros Healthcare"
      width={size}
      height={size}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
