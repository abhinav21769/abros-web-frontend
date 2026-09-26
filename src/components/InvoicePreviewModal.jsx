import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import Modal from "./ui/Modal";
import LottieLoader from "./ui/LottieLoader";
import { invoicesApi } from "../api/client";
import {
  downloadInvoicePdf,
  generateInvoicePdfBlob,
} from "../utils/invoiceExport";
import {
  createPdfObjectUrl,
  isMobileBrowser,
  openPdfBlobInNewTab,
  revokePdfObjectUrl,
} from "../utils/pdfMobile";

export default function InvoicePreviewModal({ invoice, onClose }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullInvoice, setFullInvoice] = useState(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const previewUrlRef = useRef("");
  const mobile = isMobileBrowser();

  const revokeCurrentUrl = () => {
    revokePdfObjectUrl(previewUrlRef.current);
    previewUrlRef.current = "";
  };

  useEffect(
    () => () => {
      revokeCurrentUrl();
    },
    [],
  );

  useEffect(() => {
    if (!invoice?._id) return undefined;

    let cancelled = false;

    setLoading(true);
    setError("");
    setEmbedFailed(false);
    setPreviewUrl("");
    setPdfBlob(null);
    revokeCurrentUrl();

    (async () => {
      try {
        const res = await invoicesApi.get(invoice._id);
        if (cancelled) return;

        const invoiceData = res.data;
        setFullInvoice(invoiceData);

        const blob = await generateInvoicePdfBlob(invoiceData);
        if (cancelled) return;

        const url = createPdfObjectUrl(blob);
        previewUrlRef.current = url;
        setPdfBlob(blob);
        setPreviewUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not generate preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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

  const showInlinePreview = previewUrl && !embedFailed;

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
          <button
            className="btn btn-secondary"
            onClick={handleOpenPdf}
            disabled={loading || Boolean(error)}
          >
            <ExternalLink size={16} /> Open PDF
          </button>
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
      <div
        className={`invoice-preview-body${loading ? " invoice-preview-body--loading" : ""}`}
      >
        {loading ? (
          <LottieLoader message="Generating preview..." compact />
        ) : error ? (
          <div className="invoice-preview-error">{error}</div>
        ) : showInlinePreview ? (
          <object
            data={previewUrl}
            type="application/pdf"
            className="invoice-preview-frame"
            aria-label={`Invoice ${invoice.invoiceNumber} preview`}
          >
            <iframe
              title={`Invoice ${invoice.invoiceNumber} preview`}
              src={previewUrl}
              className="invoice-preview-frame"
              onError={() => setEmbedFailed(true)}
            />
          </object>
        ) : (
          <div className="invoice-preview-mobile">
            <p>
              {mobile
                ? "Your browser could not show the PDF inline. Open it in a new tab to view, print, or share."
                : "Could not embed the PDF preview. Open it in a new tab instead."}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenPdf}
            >
              <ExternalLink size={16} /> Open PDF
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
