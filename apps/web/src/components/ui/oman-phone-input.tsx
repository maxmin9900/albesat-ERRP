"use client";

import { Input, InputProps } from "@/components/ui/input";
import { sanitizeOmanPhoneInput } from "@/lib/phone";
import { forwardRef } from "react";

export const OmanPhoneInput = forwardRef<HTMLInputElement, InputProps>(
  ({ onChange, placeholder = "+968 9XXX XXXX", ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        onChange={(e) => {
          const sanitized = sanitizeOmanPhoneInput(e.target.value);
          e.target.value = sanitized;
          onChange?.(e);
        }}
        {...props}
      />
    );
  },
);
OmanPhoneInput.displayName = "OmanPhoneInput";
