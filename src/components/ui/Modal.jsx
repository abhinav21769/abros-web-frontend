import { useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";
import useIsMobile from "../../hooks/useIsMobile";

// Desktop: the familiar centred dialog. Mobile: the same title, body and footer
// rendered as a dedicated full-screen page with a back header. Callers that
// back a dialog with a route (see hooks/useFormRoute) make `onClose` navigate
// back, so the page and the browser's back button stay in step.
export default function Modal({ title, children, footer, onClose, large, preview }) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile]);

  if (isMobile) {
    return (
      <section className="mobile-page" aria-label={title}>
        <header className="mobile-page-header">
          <button
            type="button"
            className="mobile-page-back"
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="mobile-page-title">{title}</h2>
        </header>
        <div className={`mobile-page-body${preview ? " mobile-page-body--preview" : ""}`}>
          {children}
        </div>
        {footer && <div className="mobile-page-footer">{footer}</div>}
      </section>
    );
  }

  const modalClass = [
    "modal",
    large ? "modal-lg" : "",
    preview ? "modal-preview" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
