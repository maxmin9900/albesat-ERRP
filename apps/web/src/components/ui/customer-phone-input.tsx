"use client";

import { Input, InputProps } from "@/components/ui/input";
import { sanitizeCustomerPhoneInput } from "@/lib/phone";
import { forwardRef } from "react";

/** Phone field for customer-facing forms: accepts Oman and Iran numbers. */
export const CustomerPhoneInput = forwardRef<HTMLInputElement, InputProps>(
  ({ onChange, placeholder = "+968 9XXX XXXX or 09XX XXX XXXX", ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        onChange={(e) => {
          e.target.value = sanitizeCustomerPhoneInput(e.target.value);
          onChange?.(e);
        }}
        {...props}
      />
    );
  },
);
CustomerPhoneInput.displayName = "CustomerPhoneInput";
