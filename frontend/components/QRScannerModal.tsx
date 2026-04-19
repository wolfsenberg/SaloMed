'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Upload, Loader2, AlertCircle } from 'lucide-react';
import QRPaymentConfirmModal, {
  parseSaloMedQR,
  type SaloMedQRPayload,
} from '@/components/QRPaymentConfirmModal';

interface Props {
  onDetected: (value: string) => void;
  onClose: () => void;
  /** Called when a SALOMED: QR payment is successfully processed. */
  onPaymentSuccess?: () => void;
}

export default function QRScannerModal({ onDetected, onClose, onPaymentSuccess }: Props) {
  const scannerRef  = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const [status, setStatus]   = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errMsg, setErrMsg]   = useState('');
  const stopFnRef   = useRef<(() => void) | null>(null);

  // ── SALOMED: QR payment state ───────────────────────────────────────────
  const [qrPayload, setQrPayload] = useState<SaloMedQRPayload | null>(null);

  /**
   * Central handler for any decoded QR string.
   * Routes SALOMED: payloads to the payment confirm modal,
   * plain addresses to the parent's onDetected callback.
   */
  function handleDecodedValue(decoded: string) {
    const payload = parseSaloMedQR(decoded);
    if (payload) {
      // It's a SaloMed payment QR — show the confirm modal
      setQrPayload(payload);
    } else {
      // Regular QR (Stellar address, etc.) — pass to parent
      onDetected(decoded);
      onClose();
    }
  }

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const qr = new Html5Qrcode('qr-reader');
        scanner = qr;

        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            void qr.stop().catch(() => null);
            handleDecodedValue(decoded);
          },
          () => { /* ignore non-detections */ },
        );
        setStatus('scanning');
        stopFnRef.current = () => { void qr.stop().catch(() => null); };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Camera permission denied or not supported — show file upload fallback
        setStatus('error');
        setErrMsg(msg.includes('permission') || msg.includes('NotAllowed')
          ? 'Camera access denied. Use the upload option below.'
          : 'Camera unavailable on this device.');
      }
    }

    void init();

    return () => {
      try {
        if (stopFnRef.current) {
          stopFnRef.current();
          stopFnRef.current = null;
        }
      } catch (e) {
        // ignore
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const qr = new Html5Qrcode('qr-reader-file');
      const result = await qr.scanFile(file, true);
      handleDecodedValue(result);
    } catch {
      setErrMsg('Could not read QR from image. Try a clearer photo.');
      setStatus('error');
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-blue-600" />
              <h3 className="font-bold text-slate-900">Scan QR Code</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {/* Scanner viewport */}
          <div className="relative bg-black" style={{ minHeight: 280 }}>
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 size={32} className="animate-spin text-blue-400" />
                <p className="text-sm text-white/70">Starting camera…</p>
              </div>
            )}

            {/* html5-qrcode mounts the video here */}
            <div id="qr-reader" ref={scannerRef} className="w-full" />

            {/* Scan frame overlay */}
            {status === 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 border-2 border-white/70 rounded-2xl relative">
                  {/* Corner accents */}
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-blue-400 ${cls}`} />
                  ))}

                  {/* Scanning line */}
                  <motion.div
                    className="absolute left-1 right-1 h-0.5 bg-blue-400/80 rounded"
                    animate={{ top: ['10%', '85%', '10%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 space-y-3">
            {status === 'error' && errMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{errMsg}</p>
              </div>
            )}

            <p className="text-xs text-slate-400 text-center">
              Point your camera at a provider&apos;s QR or a SaloMed payment QR
            </p>

            {/* File upload fallback */}
            <div>
              <div id="qr-reader-file" className="hidden" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Upload size={15} /> Upload QR image instead
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── SALOMED payment confirm overlay ──────────────────── */}
      <AnimatePresence>
        {qrPayload && (
          <QRPaymentConfirmModal
            payload={qrPayload}
            onClose={() => { setQrPayload(null); onClose(); }}
            onSuccess={() => {
              setQrPayload(null);
              onClose();
              onPaymentSuccess?.();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
