import { useState } from "react";

export default function BrandLogo({ size = 40, className = "" }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`brand-logo-wrap ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "10px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        backgroundColor: "#ffffff",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
      }}
    >
      {!imageError ? (
        <img
          src="/logo.jpg"
          alt="Abros Healthcare"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: "9px",
          }}
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={Math.round(size * 0.55)}
            height={Math.round(size * 0.55)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M2 12h20" />
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeOpacity="0.4" />
          </svg>
        </div>
      )}
    </div>
  );
}
