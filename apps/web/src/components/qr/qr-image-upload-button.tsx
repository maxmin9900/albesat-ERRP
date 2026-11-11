"use client";

import { Button } from "@/components/ui/button";
import {
  decodeQrFromImageFile,
  QR_IMAGE_ACCEPT,
  suggestCodeFromFilename,
} from "@/lib/qr/decode-image";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

interface QrImageUploadButtonProps {
  onDecoded: (code: string) => void;
  onError?: (message: string) => void;
  onSuggestCode?: (code: string) => void;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function QrImageUploadButton({
  onDecoded,
  onError,
  onSuggestCode,
  label = "Upload QR image",
  variant = "secondary",
  className,
}: QrImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setPendingCode(null);
    try {
      const decoded = (await decodeQrFromImageFile(file)).trim();
      if (!decoded) throw new Error("Empty QR code");
      onDecoded(decoded);
    } catch {
      const suggested = suggestCodeFromFilename(file.name);
      if (suggested) {
        setPendingCode(suggested);
        onSuggestCode?.(suggested);
        setError(
          "QR not detected in image — code suggested from filename. Confirm or edit the code field, then Add QR.",
        );
      } else {
        const message =
          "Could not read QR from image. Use a clear PNG/JPG, or type the code manually.";
        setError(message);
        onError?.(message);
      }
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={QR_IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant={variant === "primary" ? "primary" : "secondary"}
        loading={loading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
      {pendingCode && (
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full"
          onClick={() => onDecoded(pendingCode)}
        >
          Use suggested code: {pendingCode}
        </Button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
