import { X } from "lucide-react";

export default function Modal({ title, children, footer, onClose, large, preview }) {
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
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
