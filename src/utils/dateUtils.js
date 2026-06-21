const IST = "Asia/Kolkata";

function getCalendarParts(value, timeZone = IST) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function getTodayDateInputValue() {
  return toDateInputValue(new Date());
}

export function toDateInputValue(value) {
  const parts = getCalendarParts(value);
  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatCalendarDate(value) {
  const parts = getCalendarParts(value);
  if (!parts) return "";

  const date = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toInvoiceDatePayload(dateStr) {
  const [year, month, day] = dateStr.split("T")[0].split("-");
  if (!year || !month || !day) return undefined;
  return `${year}-${month}-${day}`;
}
