"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useId, useRef } from "react";

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  mask?: boolean;
  autoFocus?: boolean;
}

export function PinInput({
  length = 6,
  value,
  onChange,
  label,
  error,
  disabled,
  mask = true,
  autoFocus,
}: PinInputProps) {
  const groupId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.replace(/\D/g, "").slice(0, length).split("");
  while (digits.length < length) digits.push("");

  const setDigits = useCallback(
    (next: string[]) => {
      onChange(next.join("").replace(/\D/g, "").slice(0, length));
    },
    [length, onChange],
  );

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focusAt = (index: number) => {
    const i = Math.max(0, Math.min(index, length - 1));
    refs.current[i]?.focus();
    refs.current[i]?.select();
  };

  const applyChars = (startIndex: number, raw: string) => {
    const chars = raw.replace(/\D/g, "").slice(0, length - startIndex).split("");
    if (chars.length === 0) return;
    const next = [...digits];
    let cursor = startIndex;
    for (const ch of chars) {
      if (cursor >= length) break;
      next[cursor] = ch;
      cursor += 1;
    }
    setDigits(next);
    focusAt(Math.min(cursor, length - 1));
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-semibold text-navy" id={groupId}>
          {label}
        </label>
      )}
      <div
        className="flex justify-center gap-2 sm:gap-3"
        role="group"
        aria-labelledby={label ? groupId : undefined}
        aria-label={label ? undefined : "Access code"}
        onPaste={(e) => {
          e.preventDefault();
          applyChars(0, e.clipboardData.getData("text"));
        }}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type={mask ? "password" : "text"}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            value={digit}
            aria-invalid={!!error}
            className={cn(
              "h-12 w-11 rounded-2xl border-2 bg-surface-alt text-center text-lg font-bold text-navy sm:h-14 sm:w-12",
              "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              error ? "border-danger" : "border-border",
              disabled && "opacity-50",
            )}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) {
                const next = [...digits];
                next[index] = "";
                setDigits(next);
                return;
              }
              applyChars(index, v.slice(-1));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                const next = [...digits];
                if (next[index]) {
                  next[index] = "";
                  setDigits(next);
                } else if (index > 0) {
                  next[index - 1] = "";
                  setDigits(next);
                  focusAt(index - 1);
                }
                return;
              }
              if (e.key === "ArrowLeft" && index > 0) {
                e.preventDefault();
                focusAt(index - 1);
              }
              if (e.key === "ArrowRight" && index < length - 1) {
                e.preventDefault();
                focusAt(index + 1);
              }
            }}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      {error && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
