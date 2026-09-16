import { useState } from "react";
import { useAuth } from "../context/AuthContext";

// Initials are the fallback mark when a company has not uploaded a logo:
// "Fresh Pharma Pvt Ltd" -> "FP".
function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function BrandLogo({ size = 40, className = "", src, name }) {
  const { company } = useAuth();
  const logo = src !== undefined ? src : company?.logo;
  const companyName = name !== undefined ? name : company?.name;
  // Remembering which source failed (rather than a bare flag) means a newly
  // uploaded logo gets its own chance to render without resetting anything.
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = Boolean(logo) && failedSrc !== logo;

  const initials = getInitials(companyName);

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
      {showImage ? (
        <img
          src={logo}
          alt={companyName || "Company logo"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: "9px",
          }}
          onError={() => setFailedSrc(logo)}
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
            fontWeight: 700,
            fontSize: Math.round(size * 0.38),
            letterSpacing: "0.02em",
          }}
        >
          {initials || (
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
          )}
        </div>
      )}
    </div>
  );
}
