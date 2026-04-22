"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type DropdownOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type CustomDropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = "選択してください",
  disabled = false,
  className = ""
}: CustomDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }

    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, options, value]);

  function chooseOption(option: DropdownOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function moveActive(delta: number) {
    if (options.length === 0) return;

    let nextIndex = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      nextIndex = (nextIndex + delta + options.length) % options.length;
      if (!options[nextIndex].disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-left text-sm text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (disabled) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) setOpen(true);
            moveActive(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            moveActive(-1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
            } else if (activeIndex >= 0) {
              chooseOption(options[activeIndex]);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span className={selectedOption ? "" : "text-[color:var(--muted)]"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-2 shadow-[var(--shadow)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[color:var(--muted)]">{placeholder}</div>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={[
                    "flex w-full flex-col rounded-[16px] px-3 py-3 text-left transition",
                    option.disabled
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-white/8 focus:bg-white/8",
                    isSelected ? "bg-[color:var(--accent-soft)]" : "",
                    isActive ? "ring-1 ring-[color:var(--accent)]" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseOption(option)}
                >
                  <span className="text-sm font-medium text-[color:var(--text)]">{option.label}</span>
                  {option.description ? (
                    <span className="mt-1 text-xs text-[color:var(--muted)]">{option.description}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
