import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import CompanyProfileFields from "../components/CompanyProfileFields";
import {
  COMPANY_SECTIONS,
  companyToForm,
  emptyCompanyForm,
  formToPayload,
} from "../utils/companyProfile";
import LottieLoader from "../components/ui/LottieLoader";
import { companyApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hasErrors, validateCompanyForm } from "../utils/formValidation";

// Walks the first admin of a new company through their own details. Until it is
// finished the rest of the app is out of reach, because an invoice printed
// before this is filled in would carry no letterhead at all.
export default function Onboarding() {
  const toast = useToast();
  const navigate = useNavigate();
  const { company, isAdmin, needsOnboarding, updateCompany, loading } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() =>
    company ? companyToForm(company) : emptyCompanyForm(),
  );
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const section = COMPANY_SECTIONS[step];
  const isLastStep = step === COMPANY_SECTIONS.length - 1;
  const allErrors = useMemo(() => validateCompanyForm(form), [form]);

  if (loading) {
    return <LottieLoader fullScreen message="Loading your company..." />;
  }

  // Someone who has already onboarded (or a viewer, who cannot do this) has no
  // business on this page.
  if (!needsOnboarding || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const setField = (path, value) => {
    setForm((prev) => {
      const next = { ...prev };

      if (path.startsWith("dlNumbers.")) {
        const index = Number(path.split(".")[1]);
        next.dlNumbers = [...prev.dlNumbers];
        next.dlNumbers[index] = value;
      } else if (path.startsWith("bank.")) {
        next.bank = { ...prev.bank, [path.split(".")[1]]: value };
      } else {
        next[path] = value;
      }

      return next;
    });
    setErrors((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  // Only the fields on screen block moving on, so a blank optional step is fine
  // but a malformed GSTIN is caught where it was typed.
  const sectionErrors = (fields) =>
    Object.fromEntries(
      Object.entries(allErrors).filter(([key]) =>
        fields.some((field) => key === field || key.startsWith(`${field}.`)),
      ),
    );

  const FIELDS_BY_SECTION = {
    identity: ["name"],
    address: ["pincode", "phone", "email"],
    tax: ["gstin", "invoicePrefix", "purchasePrefix"],
    payment: ["bank.ifsc", "bank.accountNumber", "upiVpa"],
  };

  const handleNext = () => {
    const stepErrors = sectionErrors(FIELDS_BY_SECTION[section.id]);
    setErrors(stepErrors);
    if (hasErrors(stepErrors)) return;
    setStep((current) => Math.min(current + 1, COMPANY_SECTIONS.length - 1));
  };

  const handleFinish = async () => {
    setErrors(allErrors);
    if (hasErrors(allErrors)) {
      // The offending field may be on an earlier step - go back to it.
      const firstBad = Object.keys(allErrors)[0];
      const badStep = COMPANY_SECTIONS.findIndex((s) =>
        FIELDS_BY_SECTION[s.id].some(
          (field) => firstBad === field || firstBad.startsWith(`${field}.`),
        ),
      );
      if (badStep >= 0) setStep(badStep);
      toast.error("Please fix the highlighted details.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await companyApi.completeOnboarding(formToPayload(form));
      updateCompany(res.data.company);
      toast.success(res.message || "Company setup completed.");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <header className="onboarding-header">
          <p className="onboarding-eyebrow">
            Step {step + 1} of {COMPANY_SECTIONS.length}
          </p>
          <h1>{section.title}</h1>
          <p className="onboarding-subtitle">{section.description}</p>

          <div className="onboarding-steps" aria-hidden="true">
            {COMPANY_SECTIONS.map((item, index) => (
              <span
                key={item.id}
                className={`onboarding-step-dot${index <= step ? " is-done" : ""}`}
              />
            ))}
          </div>
        </header>

        <div className="form-grid onboarding-form">
          <CompanyProfileFields
            section={section.id}
            form={form}
            errors={errors}
            setField={setField}
            onLogoError={(message) => toast.error(message)}
            disabled={submitting}
          />
        </div>

        <footer className="onboarding-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinish}
              disabled={submitting}
            >
              <Check size={16} />
              {submitting ? "Saving..." : "Finish setup"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              disabled={submitting}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          )}
        </footer>

        <p className="onboarding-note">
          Everything here can be changed later from Settings.
        </p>
      </div>
    </div>
  );
}
