import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import FieldError from "./ui/FieldError";
import BrandLogo from "./BrandLogo";
import { fieldClass } from "../utils/formValidation";
import { prepareLogoFile } from "../utils/logoUpload";

// The company profile is filled in twice: once by the onboarding wizard, one
// section at a time, and again from Settings, all sections at once. Both render
// these, so the two can never drift apart.
function LogoPicker({ value, name, onChange, onError, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset first so picking the same file twice still fires a change.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      onChange(await prepareLogoFile(file));
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="logo-picker">
      <BrandLogo size={72} src={value || null} name={name} />

      <div className="logo-picker-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          style={{ display: "none" }}
          data-testid="logo-input"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
        >
          <ImagePlus size={15} />
          {busy ? "Processing..." : value ? "Replace logo" : "Upload logo"}
        </button>

        {value ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            <Trash2 size={15} />
            Remove
          </button>
        ) : null}

        <p className="logo-picker-hint">
          PNG, JPG or WebP. Large images are resized automatically.
        </p>
      </div>
    </div>
  );
}

export default function CompanyProfileFields({
  section,
  form,
  errors,
  setField,
  onLogoError,
  disabled = false,
}) {
  if (section === "identity") {
    return (
      <>
        <div className="input-group full-width">
          <label htmlFor="company-name">Company name *</label>
          <input
            id="company-name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Abros Healthcare"
            className={fieldClass(errors, "name")}
            disabled={disabled}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="input-group full-width">
          <label>Logo</label>
          <LogoPicker
            value={form.logo}
            name={form.name}
            onChange={(logo) => setField("logo", logo)}
            onError={onLogoError}
            disabled={disabled}
          />
        </div>
      </>
    );
  }

  if (section === "address") {
    return (
      <>
        <div className="input-group full-width">
          <label htmlFor="company-address">Address</label>
          <input
            id="company-address"
            value={form.addressLine}
            onChange={(e) => setField("addressLine", e.target.value)}
            placeholder="Shop / building, street"
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-city">City</label>
          <input
            id="company-city"
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-state">State</label>
          <input
            id="company-state"
            value={form.state}
            onChange={(e) => setField("state", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-pincode">Pincode</label>
          <input
            id="company-pincode"
            value={form.pincode}
            onChange={(e) => setField("pincode", e.target.value)}
            inputMode="numeric"
            className={fieldClass(errors, "pincode")}
            disabled={disabled}
          />
          <FieldError message={errors.pincode} />
        </div>

        <div className="input-group">
          <label htmlFor="company-phone">Phone</label>
          <input
            id="company-phone"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            inputMode="tel"
            className={fieldClass(errors, "phone")}
            disabled={disabled}
          />
          <FieldError message={errors.phone} />
        </div>

        <div className="input-group">
          <label htmlFor="company-email">Email</label>
          <input
            id="company-email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            className={fieldClass(errors, "email")}
            disabled={disabled}
          />
          <FieldError message={errors.email} />
        </div>
      </>
    );
  }

  if (section === "tax") {
    return (
      <>
        <div className="input-group">
          <label htmlFor="company-gstin">GSTIN</label>
          <input
            id="company-gstin"
            value={form.gstin}
            onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
            placeholder="06AAAAA0000A1Z5"
            className={fieldClass(errors, "gstin")}
            disabled={disabled}
          />
          <FieldError message={errors.gstin} />
        </div>

        <div className="input-group">
          <label htmlFor="company-dl-1">Drug licence no.</label>
          <input
            id="company-dl-1"
            value={form.dlNumbers[0]}
            onChange={(e) => setField("dlNumbers.0", e.target.value.toUpperCase())}
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-dl-2">Second drug licence no.</label>
          <input
            id="company-dl-2"
            value={form.dlNumbers[1]}
            onChange={(e) => setField("dlNumbers.1", e.target.value.toUpperCase())}
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-invoice-prefix">Sale invoice prefix</label>
          <input
            id="company-invoice-prefix"
            value={form.invoicePrefix}
            onChange={(e) => setField("invoicePrefix", e.target.value.toUpperCase())}
            placeholder="INV"
            className={fieldClass(errors, "invoicePrefix")}
            disabled={disabled}
          />
          <FieldError message={errors.invoicePrefix} />
          <span className="input-hint">
            Bills are numbered {(form.invoicePrefix || "INV").toUpperCase()}-
            {new Date().getFullYear()}-001
          </span>
        </div>

        <div className="input-group">
          <label htmlFor="company-purchase-prefix">Purchase prefix</label>
          <input
            id="company-purchase-prefix"
            value={form.purchasePrefix}
            onChange={(e) => setField("purchasePrefix", e.target.value.toUpperCase())}
            placeholder="PO"
            className={fieldClass(errors, "purchasePrefix")}
            disabled={disabled}
          />
          <FieldError message={errors.purchasePrefix} />
        </div>
      </>
    );
  }

  if (section === "payment") {
    return (
      <>
        <div className="input-group full-width">
          <label htmlFor="company-bank">Bank name and branch</label>
          <input
            id="company-bank"
            value={form.bank.name}
            onChange={(e) => setField("bank.name", e.target.value)}
            placeholder="e.g. Punjab National Bank, Prem Nagar"
            disabled={disabled}
          />
        </div>

        <div className="input-group">
          <label htmlFor="company-account">Account number</label>
          <input
            id="company-account"
            value={form.bank.accountNumber}
            onChange={(e) => setField("bank.accountNumber", e.target.value)}
            inputMode="numeric"
            className={fieldClass(errors, "bank.accountNumber")}
            disabled={disabled}
          />
          <FieldError message={errors["bank.accountNumber"]} />
        </div>

        <div className="input-group">
          <label htmlFor="company-ifsc">IFSC</label>
          <input
            id="company-ifsc"
            value={form.bank.ifsc}
            onChange={(e) => setField("bank.ifsc", e.target.value.toUpperCase())}
            className={fieldClass(errors, "bank.ifsc")}
            disabled={disabled}
          />
          <FieldError message={errors["bank.ifsc"]} />
        </div>

        <div className="input-group">
          <label htmlFor="company-upi">UPI ID</label>
          <input
            id="company-upi"
            value={form.upiVpa}
            onChange={(e) => setField("upiVpa", e.target.value)}
            placeholder="yourshop@bank"
            className={fieldClass(errors, "upiVpa")}
            disabled={disabled}
          />
          <FieldError message={errors.upiVpa} />
          <span className="input-hint">
            Leave blank to keep the Scan to Pay QR off your invoices.
          </span>
        </div>
      </>
    );
  }

  return null;
}
