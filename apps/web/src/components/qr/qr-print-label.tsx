"use client";

import { QrCodeDisplay } from "@/components/dashboard/qr-code-display";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useRef } from "react";

interface QrPrintLabelProps {
  qrCode: string;
  carpetCode: string;
  sessionCode?: string;
  customerName?: string;
  trackingCode?: string;
}

export function QrPrintLabel({
  qrCode,
  carpetCode,
  sessionCode,
  customerName,
  trackingCode,
}: QrPrintLabelProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=520");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>QR Label — ${carpetCode}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; text-align: center; }
        h1 { font-size: 14px; margin: 8px 0 4px; }
        p { margin: 4px 0; font-size: 12px; color: #444; }
        .brand { color: #00B5AD; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <>
      <div ref={printRef} className="sr-only" aria-hidden>
        <p className="brand">ALBESAT CARPET PRO</p>
        <QrCodeDisplay value={qrCode} size={160} />
        <h1>{carpetCode}</h1>
        {sessionCode && <p>Session: {sessionCode}</p>}
        {customerName && <p>{customerName}</p>}
        {trackingCode && <p>#{trackingCode}</p>}
      </div>
      <Button type="button" variant="navy" className="w-full" onClick={handlePrint}>
        <Printer className="h-4 w-4" /> Print QR Label
      </Button>
    </>
  );
}
