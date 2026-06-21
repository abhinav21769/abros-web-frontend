export function getLineUnits(item) {
  return (Number(item?.quantity) || 0) + (Number(item?.free) || 0);
}

function getMedicineId(value) {
  if (!value) return "";
  return String(value._id || value);
}

export function getAvailableStockForLine({
  formItems,
  medicines,
  lineIndex,
  editingInvoice,
  formStatus,
}) {
  const item = formItems[lineIndex];
  const medicineId = getMedicineId(item?.medicine);
  if (!medicineId) return null;

  const medicine = medicines.find((med) => med._id === medicineId);
  if (!medicine) return 0;

  let available = Number(medicine.quantity) || 0;

  const invoiceWasActive =
    editingInvoice && editingInvoice.status !== "cancelled";
  const formIsActive = formStatus !== "cancelled";

  if (invoiceWasActive && formIsActive) {
    editingInvoice.items.forEach((orig) => {
      if (getMedicineId(orig.medicine) === medicineId) {
        available += getLineUnits(orig);
      }
    });
  }

  formItems.forEach((line, index) => {
    if (index === lineIndex) return;
    if (getMedicineId(line.medicine) === medicineId) {
      available -= getLineUnits(line);
    }
  });

  return Math.max(available, 0);
}

export function getMedicineStockLabel(medicine, medicines, formItems, editingInvoice, formStatus) {
  if (!medicine) return "";
  const index = formItems.findIndex(
    (item) => getMedicineId(item.medicine) === medicine._id,
  );
  if (index < 0) {
    return `Stock: ${Number(medicine.quantity) || 0}`;
  }
  const available = getAvailableStockForLine({
    formItems,
    medicines,
    lineIndex: index,
    editingInvoice,
    formStatus,
  });
  return `Available: ${available ?? 0}`;
}
