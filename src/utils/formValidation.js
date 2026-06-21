const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_REGEX = /^\d{4,8}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function clearFieldError(errors, field) {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

function required(value, label) {
  if (String(value ?? "").trim()) return "";
  return `${label} is required.`;
}

function optionalPattern(value, regex, message) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return regex.test(trimmed) ? "" : message;
}

function positiveNumber(value, label, { allowZero = false } = {}) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return `${label} is required.`;
  const num = Number(value);
  if (!Number.isFinite(num)) return `${label} must be a valid number.`;
  if (allowZero ? num < 0 : num <= 0) {
    return `${label} must be greater than ${allowZero ? "or equal to 0" : "0"}.`;
  }
  return "";
}

function integerAtLeast(value, label, min) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return `${label} is required.`;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min) {
    return `${label} must be a whole number of at least ${min}.`;
  }
  return "";
}

function futureDate(value, label) {
  const message = required(value, label);
  if (message) return message;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${label} is invalid.`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date <= today) return `${label} must be in the future.`;

  return "";
}

export function validateLoginForm({ username, password }) {
  const errors = {};

  const nameError = required(username, "Username");
  if (nameError) errors.username = nameError;
  else if (username.trim().length < 2) {
    errors.username = "Username must be at least 2 characters.";
  }

  const passwordError = required(password, "Password");
  if (passwordError) errors.password = passwordError;
  else if (password.length < 4) {
    errors.password = "Password must be at least 4 characters.";
  }

  return errors;
}

export function validateCustomerForm(form) {
  const errors = {};

  const nameError = required(form.name, "Customer name");
  if (nameError) errors.name = nameError;
  else if (form.name.trim().length < 2) {
    errors.name = "Customer name must be at least 2 characters.";
  }

  const addressError = required(form.address, "Address");
  if (addressError) errors.address = addressError;
  else if (form.address.trim().length < 5) {
    errors.address = "Address must be at least 5 characters.";
  }

  const phoneError = optionalPattern(
    form.contact,
    PHONE_REGEX,
    "Contact must be a valid 10-digit mobile number.",
  );
  if (phoneError) errors.contact = phoneError;

  const gstinError = optionalPattern(
    form.gstin,
    GSTIN_REGEX,
    "GSTIN must be a valid 15-character GST number.",
  );
  if (gstinError) errors.gstin = gstinError;

  if (form.dlNo?.trim() && form.dlNo.trim().length < 3) {
    errors.dlNo = "Drug license number must be at least 3 characters.";
  }

  return errors;
}

export function validateMedicineForm(form) {
  const errors = {};

  const nameError = required(form.name, "Medicine name");
  if (nameError) errors.name = nameError;

  const packagingError = required(form.packagingType, "Packaging type");
  if (packagingError) errors.packagingType = packagingError;

  const expiryError = futureDate(form.expiryDate, "Expiry date");
  if (expiryError) errors.expiryDate = expiryError;

  const mrpError = positiveNumber(form.mrp, "MRP");
  if (mrpError) errors.mrp = mrpError;

  const rateError = positiveNumber(form.rate, "Rate");
  if (rateError) errors.rate = rateError;

  if (!errors.mrp && !errors.rate) {
    if (Number(form.rate) > Number(form.mrp)) {
      errors.rate = "Rate cannot be greater than MRP.";
    }
  }

  if (form.quantity !== "" && form.quantity != null) {
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      errors.quantity = "Quantity must be a whole number of 0 or more.";
    }
  }

  const hsnError = optionalPattern(
    form.hsn,
    HSN_REGEX,
    "HSN must be 4 to 8 digits.",
  );
  if (hsnError) errors.hsn = hsnError;

  return errors;
}

export function validateInvoiceForm(form) {
  const errors = {};

  const invoiceNumberError = required(form.invoiceNumber, "Invoice number");
  if (invoiceNumberError) errors.invoiceNumber = invoiceNumberError;

  const dateError = required(form.invoiceDate, "Invoice date");
  if (dateError) errors.invoiceDate = dateError;

  if (!form.customer) errors.customer = "Customer is required.";

  if (!form.items?.length) {
    errors.items = "Add at least one line item.";
  }

  form.items?.forEach((item, index) => {
    if (!item.medicine) {
      errors[`items.${index}.medicine`] = "Medicine is required.";
    }

    const qtyError = integerAtLeast(item.quantity, "Quantity", 1);
    if (qtyError) errors[`items.${index}.quantity`] = qtyError;

    if (item.free !== "" && item.free != null) {
      const free = Number(item.free);
      if (!Number.isFinite(free) || free < 0 || !Number.isInteger(free)) {
        errors[`items.${index}.free`] =
          "Free quantity must be a whole number of 0 or more.";
      }
    }

    const rateError = positiveNumber(item.rate, "Rate");
    if (rateError) errors[`items.${index}.rate`] = rateError;

    const hsnError = optionalPattern(
      item.hsn,
      HSN_REGEX,
      "HSN must be 4 to 8 digits.",
    );
    if (hsnError) errors[`items.${index}.hsn`] = hsnError;
  });

  return errors;
}

export function fieldClass(errors, field) {
  return errors[field] ? "has-error" : "";
}
