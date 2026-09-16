import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import LottieLoader from "./ui/LottieLoader";
import BrandLogo from "./BrandLogo";
import { useAuth } from "../context/AuthContext";
import {
  generateUpiQrDataUrl,
  getInvoicePaymentNote,
} from "../utils/upiPayment";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);
}

export default function PaymentQrModal({ invoice, onClose }) {
  const { company } = useAuth();
  const upiId = company?.upiVpa || "";
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoice || !upiId) {
      setError("No UPI ID on your company profile. Add one in Settings.");
      setLoading(false);
      return;
    }

    generateUpiQrDataUrl({
      upiId,
      payeeName: company?.name,
      amount: invoice.total,
      note: getInvoicePaymentNote(invoice),
    })
      .then(setQrDataUrl)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [invoice, upiId, company?.name]);

  if (!invoice) return null;

  return (
    <Modal title="Pay via UPI" onClose={onClose}>
      <div className="payment-qr-modal">
        {!loading ? <BrandLogo size={48} className="payment-qr-brand" /> : null}
        {loading ? (
          <LottieLoader message="Generating payment QR..." compact logoSize={40} />
        ) : error ? (
          <div className="payment-qr-error">{error}</div>
        ) : (
          <>
            <img
              src={qrDataUrl}
              alt={`UPI payment QR for ${invoice.invoiceNumber}`}
              className="payment-qr-image"
            />
            <div className="payment-qr-amount">{formatCurrency(invoice.total)}</div>
            <p className="payment-qr-invoice">Invoice {invoice.invoiceNumber}</p>
            <p className="payment-qr-help">
              Scan with PhonePe, Google Pay, Paytm, or any UPI app
            </p>
            <p className="payment-qr-upi">
              UPI ID: <strong>{upiId}</strong>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
