// Shape and section layout of the company profile, shared by the onboarding
// wizard and the Settings page so the two can never drift apart.
export const COMPANY_SECTIONS = [
  {
    id: "identity",
    title: "Your company",
    description: "This is the name and logo that brand the app and your invoices.",
  },
  {
    id: "address",
    title: "Address and contact",
    description: "Printed as the letterhead on every bill you issue.",
  },
  {
    id: "tax",
    title: "Tax and licences",
    description: "Your GSTIN, drug licence numbers and invoice numbering.",
  },
  {
    id: "payment",
    title: "Payment details",
    description: "Shown in the bank block, and used for the UPI QR on invoices.",
  },
];

export function emptyCompanyForm() {
  return {
    name: "",
    logo: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    gstin: "",
    dlNumbers: ["", ""],
    bank: { name: "", ifsc: "", accountNumber: "" },
    upiVpa: "",
    invoicePrefix: "",
    purchasePrefix: "",
    telegramChatId: "",
  };
}

export function companyToForm(company) {
  const base = emptyCompanyForm();
  if (!company) return base;

  const dlNumbers = company.dlNumbers?.length ? [...company.dlNumbers] : [];
  while (dlNumbers.length < 2) dlNumbers.push("");

  return {
    ...base,
    ...company,
    logo: company.logo || "",
    dlNumbers,
    bank: { ...base.bank, ...(company.bank || {}) },
  };
}

// Blank optional fields are sent as empty strings so clearing one actually
// clears it server-side.
export function formToPayload(form) {
  return {
    name: form.name.trim(),
    logo: form.logo || "",
    addressLine: form.addressLine.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    gstin: form.gstin.trim().toUpperCase(),
    dlNumbers: form.dlNumbers.map((value) => value.trim()).filter(Boolean),
    bank: {
      name: form.bank.name.trim(),
      ifsc: form.bank.ifsc.trim().toUpperCase(),
      accountNumber: form.bank.accountNumber.trim(),
    },
    upiVpa: form.upiVpa.trim(),
    invoicePrefix: form.invoicePrefix.trim().toUpperCase() || "INV",
    purchasePrefix: form.purchasePrefix.trim().toUpperCase() || "PO",
  };
}
