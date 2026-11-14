import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n) => String(n).padStart(2, "0");
const toKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

function parseKey(key) {
  const [y, m, d] = String(key || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

/**
 * An always-open month calendar. Values are plain YYYY-MM-DD strings (the same
 * shape as <input type="date">), so no timezone conversion ever touches the
 * picked day. Days outside [min, max] are disabled.
 */
export default function CalendarPicker({ value, onChange, min, max }) {
  const selected = parseKey(value);
  const today = new Date();
  const [view, setView] = useState({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth(),
  });

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const monthStart = toKey(view.year, view.month, 1);
  const monthEnd = toKey(view.year, view.month, daysInMonth);
  const canGoBack = !min || min < monthStart;
  const canGoForward = !max || max > monthEnd;

  const shiftMonth = (delta) =>
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <div className="calendar-picker">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="calendar-title">
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => shiftMonth(1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="calendar-weekday">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />;
          const key = toKey(view.year, view.month, day);
          const disabled = (min && key < min) || (max && key > max);
          const isSelected = key === value;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={key}
              className={`calendar-day${isSelected ? " is-selected" : ""}${
                key === max ? " is-today" : ""
              }`}
              onClick={() => onChange(key)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
