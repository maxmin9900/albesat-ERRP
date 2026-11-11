"use client";

import { Button } from "@/components/ui/button";
import {
  decodeQrFromImageFile,
  QR_IMAGE_ACCEPT,
  suggestCodeFromFilename,
} from "@/lib/qr/decode-image";
import { Camera, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { canUseLiveCamera } from "@/lib/secure-ip";

/** Bump on each scanner fix so we can confirm on the phone that fresh code is live
 *  (if you still see the OLD error and this tag is missing, the build is cached). */
const SCANNER_BUILD = "scan-v4";

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  /** Fill manual input when decode fails but filename may contain the code. */
  onSuggestCode?: (code: string) => void;
  active?: boolean;
  onError?: (message: string | null) => void;
}

type Html5QrcodeInstance = {
  start: (
    cameraIdOrConfig: string | MediaTrackConstraints,
    config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number },
    onSuccess: (decoded: string) => void,
    onError: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  getState: () => number;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
};

const SCANNING = 2;
const PAUSED = 3;

async function safeStopScanner(scanner: Html5QrcodeInstance | null): Promise<void> {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === SCANNING || state === PAUSED) {
      await scanner.stop();
    }
    scanner.clear();
  } catch {
    /* already stopped */
  }
}

/** html5-qrcode often throws a *string* (e.g. "NotReadableError: Could not start video
 *  source") rather than an Error, so match against name+message combined. */
function errParts(err: unknown): { name: string; message: string; hay: string } {
  const name = err instanceof Error ? err.name : "";
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  return { name, message, hay: `${name} ${message}` };
}

function isPermissionDenied(err: unknown): boolean {
  const { hay } = errParts(err);
  return /notallowed|permissiondenied|permission denied/i.test(hay);
}

function cameraErrorMessage(err: unknown): {
  message: string;
  permissionDenied: boolean;
  detail: string | null;
} {
  const { name, message, hay } = errParts(err);
  const detail = ((name ? `${name}: ${message}` : message).trim() || null)?.slice(0, 180) ?? null;
  if (isPermissionDenied(err)) {
    return {
      permissionDenied: true,
      detail,
      message: "Camera blocked. Allow camera in browser settings, then tap Retry.",
    };
  }
  if (/notfound|devicesnotfound|no camera|device not found|requested device/i.test(hay)) {
    return { permissionDenied: false, detail, message: "No camera found on this device." };
  }
  if (
    /notreadable|could not start video|starting video|video source|in use|busy|track start|aborterror/i.test(
      hay,
    )
  ) {
    return {
      permissionDenied: false,
      detail,
      message: "Camera is busy. Close other camera apps/tabs, then retry.",
    };
  }
  if (/overconstrained|constraintnotsatisfied|constraint/i.test(hay)) {
    return {
      permissionDenied: false,
      detail,
      message: "This phone's camera rejected the settings. Tap Retry.",
    };
  }
  if (/notsupported|securecontext|getusermedia|mediadevices|not supported/i.test(hay)) {
    return {
      permissionDenied: false,
      detail,
      message: "Camera needs a secure (https) page. Use the photo option below.",
    };
  }
  if (/chunkload|loading chunk|dynamically imported|failed to fetch|importing a module/i.test(hay)) {
    return {
      permissionDenied: false,
      detail,
      message: "Scanner script failed to load. Hard-refresh the page, then retry.",
    };
  }
  return { permissionDenied: false, detail, message: "Could not start camera. Tap Retry." };
}

async function pickCameraId(
  getCameras: () => Promise<{ id: string; label: string }[]>,
): Promise<string | null> {
  const cameras = await getCameras();
  if (!cameras.length) return null;
  const back = cameras.find((c) => /back|rear|environment|ultra|wide/i.test(c.label));
  if (back) return back.id;
  const front = cameras.find((c) => /front|user|facetime|selfie/i.test(c.label));
  return (front ?? cameras[cameras.length - 1]).id;
}
function PhotoScanPanel({
  decodingPhoto,
  onTakePhoto,
  onPickGallery,
}: {
  decodingPhoto: boolean;
  onTakePhoto: () => void;
  onPickGallery: () => void;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-xl bg-navy px-4 py-8 text-center">
      <p className="text-sm text-white/90">
        Live video scan needs HTTPS. Upload a QR photo (PNG/JPG) or take a picture instead.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button type="button" size="lg" loading={decodingPhoto} onClick={onTakePhoto}>
          <Camera className="h-4 w-4" />
          Take photo of QR
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="bg-white/90"
          loading={decodingPhoto}
          onClick={onPickGallery}
        >
          <ImageIcon className="h-4 w-4" />
          Choose from gallery / upload PNG
        </Button>
      </div>
    </div>
  );
}

export function QrCameraScanner({
  onScan,
  onSuggestCode,
  active = true,
  onError,
}: QrCameraScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const captureInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const onScanRef = useRef(onScan);
  const onSuggestRef = useRef(onSuggestCode);
  const onErrorRef = useRef(onError);
  const lastCode = useRef("");
  const startingRef = useRef(false);

  const liveCameraSupported = canUseLiveCamera();

  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [decodingPhoto, setDecodingPhoto] = useState(false);
  const [awaitingUserGesture, setAwaitingUserGesture] = useState(liveCameraSupported);

  onScanRef.current = onScan;
  onSuggestRef.current = onSuggestCode;
  onErrorRef.current = onError;

  const reportError = useCallback(
    (message: string | null, denied = false, detail: string | null = null) => {
      setError(message);
      setErrorDetail(message ? detail : null);
      setHint(null);
      setPermissionDenied(denied);
      onErrorRef.current?.(message);
    },
    [],
  );

  const deliverCode = useCallback((decoded: string) => {
    if (!decoded || decoded === lastCode.current) return;
    lastCode.current = decoded;
    setSuggestedCode(null);
    setHint(null);
    setError(null);
    onScanRef.current(decoded);
  }, []);

  const decodePhotoFile = useCallback(
    async (file: File) => {
      setDecodingPhoto(true);
      reportError(null);
      setHint(null);
      setSuggestedCode(null);
      try {
        const decoded = (await decodeQrFromImageFile(file)).trim();
        if (!decoded) throw new Error("Empty QR code");
        deliverCode(decoded);
      } catch {
        const suggested = suggestCodeFromFilename(file.name);
        if (suggested) {
          setSuggestedCode(suggested);
          onSuggestRef.current?.(suggested);
          setHint(
            "QR not detected in image — code filled from filename. Verify above, then confirm.",
          );
        } else {
          reportError(
            "Could not read QR from image. Use a clear PNG/JPG or type the code manually.",
          );
        }
      } finally {
        setDecodingPhoto(false);
        if (captureInputRef.current) captureInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      }
    },
    [deliverCode, reportError],
  );

  const runScanner = useCallback(async () => {
    if (startingRef.current || !liveCameraSupported) return;

    startingRef.current = true;
    setStarting(true);
    reportError(null);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    if (!document.getElementById(regionId)) {
      reportError("Scanner not ready. Tap Retry.");
      startingRef.current = false;
      setStarting(false);
      return;
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await safeStopScanner(scannerRef.current);
      scannerRef.current = null;

      const config = { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 };
      const onSuccess = (decoded: string) => deliverCode(decoded);
      const onFrameError = () => {};

      // Each attempt uses a FRESH instance with a cleared host. Reusing one instance
      // across start attempts triggers html5-qrcode's
      // "Cannot transition to a new state, already under transition" error.
      const attemptStart = async (camera: string | MediaTrackConstraints) => {
        await safeStopScanner(scannerRef.current);
        scannerRef.current = null;
        const host = document.getElementById(regionId);
        if (host) host.innerHTML = "";
        const fresh = new Html5Qrcode(regionId) as unknown as Html5QrcodeInstance;
        scannerRef.current = fresh;
        await fresh.start(camera, config, onSuccess, onFrameError);
      };

      try {
        await attemptStart({ facingMode: { ideal: "environment" } });
      } catch {
        // Let the camera + state machine settle before a fresh attempt.
        await new Promise((r) => setTimeout(r, 350));
        try {
          const cameraId = await pickCameraId(() => Html5Qrcode.getCameras());
          await attemptStart(cameraId ?? { facingMode: "user" });
        } catch {
          await new Promise((r) => setTimeout(r, 350));
          await attemptStart({ facingMode: "user" });
        }
      }
    } catch (err) {
      await safeStopScanner(scannerRef.current);
      scannerRef.current = null;
      const info = cameraErrorMessage(err);
      reportError(info.message, info.permissionDenied, info.detail);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [regionId, deliverCode, reportError, liveCameraSupported]);

  const startLiveCamera = useCallback(async () => {
    if (!liveCameraSupported) return;
    lastCode.current = "";
    reportError(null);
    setAwaitingUserGesture(false);
    // Let html5-qrcode acquire the camera once (its .start() triggers the permission
    // prompt). A separate priming getUserMedia + stop caused a release/re-acquire race
    // that surfaced as NotReadableError ("Could not start video source") on Android.
    try {
      await runScanner();
    } catch (err) {
      const info = cameraErrorMessage(err);
      reportError(info.message, info.permissionDenied, info.detail);
      setAwaitingUserGesture(true);
      setStarting(false);
    }
  }, [reportError, runScanner, liveCameraSupported]);

  useEffect(() => {
    if (!active) {
      void safeStopScanner(scannerRef.current);
      scannerRef.current = null;
      setAwaitingUserGesture(liveCameraSupported);
      setError(null);
      setErrorDetail(null);
      setHint(null);
      setSuggestedCode(null);
      setPermissionDenied(false);
      return;
    }
  }, [active, liveCameraSupported]);

  useEffect(() => {
    return () => {
      void safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, []);

  const fileInputs = (
    <>
      <input
        ref={captureInputRef}
        type="file"
        accept={QR_IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void decodePhotoFile(file);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={QR_IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void decodePhotoFile(file);
        }}
      />
    </>
  );

  const feedback = (
    <>
      {hint && (
        <p className="mt-2 rounded-xl bg-primary/10 px-4 py-3 text-center text-sm text-primary">
          {hint}
        </p>
      )}
      {suggestedCode && (
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full"
          onClick={() => deliverCode(suggestedCode)}
        >
          Use code: {suggestedCode}
        </Button>
      )}
      {error && (
        <p className="mt-2 rounded-xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );

  if (!active) {
    return <div className="relative min-h-[280px] w-full rounded-xl bg-black/20" aria-hidden />;
  }

  if (!liveCameraSupported) {
    return (
      <>
        {fileInputs}
        <PhotoScanPanel
          decodingPhoto={decodingPhoto}
          onTakePhoto={() => captureInputRef.current?.click()}
          onPickGallery={() => galleryInputRef.current?.click()}
        />
        {feedback}
      </>
    );
  }

  return (
    <div className="relative min-h-[280px] w-full">
      {fileInputs}
      {/* html5-qrcode injects the live <video> INTO this element — it must be visible,
          not the old off-screen hidden host, or mobile browsers pause the video. */}
      <div
        id={regionId}
        className="min-h-[280px] w-full overflow-hidden rounded-xl bg-black [&_video]:h-full [&_video]:w-full [&_video]:rounded-xl [&_video]:object-cover"
      />

      {awaitingUserGesture && !error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-navy/90 px-4 py-6 text-center">
          <p className="text-sm text-white/90">Tap to start live QR scanning.</p>
          <Button type="button" size="lg" onClick={() => void startLiveCamera()}>
            Allow camera
          </Button>
          <p className="font-mono text-[9px] text-white/40" dir="ltr">
            {SCANNER_BUILD}
          </p>
        </div>
      )}

      {starting && !error && !awaitingUserGesture && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 text-sm text-white">
          Starting camera...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl bg-amber-50 px-4 py-6 text-center">
          <p className="text-sm text-amber-900">{error}</p>
          <p className="text-xs text-amber-700">
            No camera? You can take or upload a photo of the QR instead.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button type="button" size="sm" onClick={() => void startLiveCamera()}>
              {permissionDenied ? "Allow camera" : "Retry live camera"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={decodingPhoto}
              onClick={() => captureInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Take photo of QR
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={decodingPhoto}
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
              Upload QR photo
            </Button>
          </div>
          {errorDetail && (
            <p className="mt-1 max-w-xs break-words font-mono text-[10px] leading-tight text-amber-600/80" dir="ltr">
              {errorDetail}
            </p>
          )}
          <p className="font-mono text-[9px] text-amber-500/70" dir="ltr">
            {SCANNER_BUILD}
          </p>
        </div>
      )}

      {!error && !awaitingUserGesture && !starting && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1 bg-white/90 text-xs"
            loading={decodingPhoto}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImageIcon className="h-3 w-3" />
            Upload QR photo
          </Button>
        </div>
      )}

      {feedback}
    </div>
  );
}
