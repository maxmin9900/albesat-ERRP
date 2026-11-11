"use client";

import { QRCodeSVG } from "qrcode.react";

interface QrCodeDisplayProps {
  value: string;
  size?: number;
}

export function QrCodeDisplay({ value, size = 160 }: QrCodeDisplayProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin
        fgColor="#0F172A"
        bgColor="#FFFFFF"
      />
    </div>
  );
}
