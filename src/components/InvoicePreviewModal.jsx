import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import Modal from "./ui/Modal";
import LottieLoader from "./ui/LottieLoader";
import { invoicesApi } from "../api/client";
import {
  downloadInvoicePdf,
  generateInvoicePdfBlob,
} from "../utils/invoiceExport";
import { isMobileBrowser, openPdfBlobInNewTab } from "../utils/pdfMobile";

export default function InvoicePreviewModal({ invoice, onClose }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullInvoice, setFullInvoice] = useState(null);
  const mobile = isMobileBrowser();

  useEffect(() => {
    if (!invoice?._id) return undefined;

    let cancelled = false;
    let objectUrl = "";

    setLoading(true);
    setError("");
    setPreviewUrl("");
    setPdfBlob(null);

    invoicesApi
      .get(invoice._id)
      .then(async (res) => {
        if (cancelled) return;
        setFullInvoice(res.data);
        const blob = await generateInvoicePdfBlob(res.data);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice?._id]);

  const handleDownload = async () => {
    try {
      const data =
        fullInvoice || (await invoicesApi.get(invoice._id)).data;
      await downloadInvoicePdf(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenPdf = () => {
    if (pdfBlob) {
      openPdfBlobInNewTab(pdfBlob);
      return;
    }
    if (previewUrl) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      title={`Preview — ${invoice.invoiceNumber}`}
      onClose={onClose}
      preview
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {mobile ? (
            <button
              className="btn btn-primary"
              onClick={handleOpenPdf}
              disabled={loading || Boolean(error)}
            >
              <ExternalLink size={16} /> Open PDF
            </button>
          ) : null}
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={loading || Boolean(error)}
          >
            <Download size={16} /> Download PDF
          </button>
        </>
      }
    >
      <div className="invoice-preview-body">
        {loading ? (
          <LottieLoader message="Generating preview..." compact />
        ) : error ? (
          <div className="invoice-preview-error">{error}</div>
        ) : mobile ? (
          <div className="invoice-preview-mobile">
            <p>
              PDF preview is limited in mobile browsers. Open the invoice PDF to
              view, print, or share it from your phone.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenPdf}
            >
              <ExternalLink size={16} /> Open PDF
            </button>
          </div>
        ) : (
          <iframe
            title={`Invoice ${invoice.invoiceNumber} preview`}
            src={previewUrl}
            className="invoice-preview-frame"
          />
        )}
      </div>
    </Modal>
  );
}
