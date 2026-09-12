import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * A searchable dropdown driven from the keyboard: the top match is highlighted
 * as you type, Enter picks it, and the arrow keys move the highlight.
 *
 * `options` are `{ value, label, sublabel, searchText, triggerLabel }`.
 * `searchText` is what the filter matches on - it defaults to the label, so a
 * caller that wants a phone number or GSTIN to be searchable puts those in it.
 * `triggerLabel` is what the closed control shows once that option is picked,
 * for callers that want more there than the row's own label.
 */
export default function SearchSelect({
  options,
  value,
  onSelect,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  noResultsLabel = "No match for",
  hasError = false,
  disabled = false,
  triggerRef,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  // The row Enter picks. Always starts at the top match, so typing a name and
  // hitting Enter fills the field without touching the mouse.
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const optionsRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return options;
    return options.filter((o) =>
      (o.searchText || o.label || "").toLowerCase().includes(term),
    );
  }, [options, search]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // A filter that shrinks the list can leave activeIndex past the end, so the
  // highlight is clamped here rather than chased with an effect.
  const activeOption = filtered.length
    ? Math.min(activeIndex, filtered.length - 1)
    : -1;

  useEffect(() => {
    if (!isOpen || activeOption < 0) return;
    optionsRef.current?.children[activeOption]?.scrollIntoView({
      block: "nearest",
    });
  }, [isOpen, activeOption]);

  const selectOption = (option) => {
    onSelect(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (!filtered.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((activeOption + step + filtered.length) % filtered.length);
      return;
    }

    if (e.key === "Enter") {
      // These dropdowns sit inside the invoice form. Enter picks an option
      // here; it must not submit the form or reach the row's own handler.
      e.preventDefault();
      e.stopPropagation();
      if (activeOption >= 0) selectOption(filtered[activeOption]);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  const openDropdown = (open) => {
    setIsOpen(open);
    if (open) setActiveIndex(0);
  };

  return (
    <div ref={dropdownRef} className="searchable-select-wrap">
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        className={`searchable-select-trigger ${hasError ? "has-error" : ""}`}
        onClick={() => openDropdown(!isOpen)}
      >
        <span>
          {selected ? selected.triggerLabel || selected.label : placeholder}
        </span>
        <Search size={15} className="searchable-select-icon" />
      </button>

      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search-box">
            <Search size={14} className="searchable-select-search-icon" />
            <input
              type="text"
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="searchable-select-input"
            />
            {search && (
              <button
                type="button"
                className="searchable-select-clear"
                onClick={() => {
                  setSearch("");
                  setActiveIndex(0);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="searchable-select-options" ref={optionsRef}>
            {filtered.length === 0 ? (
              <div className="searchable-select-no-results">
                {noResultsLabel} "{search}"
              </div>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={`searchable-select-option ${option.value === value ? "is-selected" : ""} ${index === activeOption ? "is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <div className="searchable-select-option-main">
                    {option.label}
                  </div>
                  {option.sublabel && (
                    <div className="searchable-select-option-sub">
                      {option.sublabel}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
