import { X } from "lucide-react";

export default function Modal({ title, children, footer, onClose, large }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${large ? " modal-lg" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
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
