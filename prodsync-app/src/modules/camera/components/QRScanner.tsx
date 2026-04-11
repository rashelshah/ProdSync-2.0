import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Surface } from '@/components/shared/Surface'
import { resolveErrorMessage } from '@/lib/toast'

interface QRScannerProps {
  open: boolean
  onClose: () => void
  onDetected: (qrData: string) => Promise<void>
}

export function QRScanner({
  open,
  onClose,
  onDetected,
}: QRScannerProps) {
  const scannerId = useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onDetectedRef = useRef(onDetected)
  const hasScannedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    if (!open) {
      return
    }

    let isActive = true
    const regionId = `camera-qr-${scannerId}`
    const config = {
      fps: 10,
      qrbox: { width: 240, height: 240 },
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    }

    hasScannedRef.current = false
    setError(null)
    setIsProcessing(false)

    async function startScanner() {
      const scanner = new Html5Qrcode(regionId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })

      scannerRef.current = scanner

      const handleDecodedText = (decodedText: string) => {
        if (hasScannedRef.current || !isActive) {
          return
        }

        hasScannedRef.current = true
        setIsProcessing(true)
        setError(null)

        void onDetectedRef.current(decodedText)
          .catch(scanError => {
            if (!isActive) {
              return
            }

            hasScannedRef.current = false
            setError(resolveErrorMessage(scanError, 'Invalid QR'))
          })
          .finally(() => {
            if (isActive) {
              setIsProcessing(false)
            }
          })
      }

      try {
        try {
          await scanner.start(
            { facingMode: { exact: 'environment' } },
            config,
            handleDecodedText,
            () => undefined,
          )
        } catch {
          await scanner.start(
            { facingMode: 'environment' },
            config,
            handleDecodedText,
            () => undefined,
          )
        }
      } catch (scanError) {
        if (!isActive) {
          return
        }

        setError(resolveErrorMessage(scanError, 'Unable to access the device camera.'))
      }
    }

    void startScanner()

    return () => {
      isActive = false
      hasScannedRef.current = false
      setIsProcessing(false)

      const scanner = scannerRef.current
      scannerRef.current = null

      if (!scanner) {
        return
      }

      void (async () => {
        try {
          const state = scanner.getState()

          if (
            state === Html5QrcodeScannerState.SCANNING
            || state === Html5QrcodeScannerState.PAUSED
          ) {
            await scanner.stop()
          }
        } catch {
          // Ignore shutdown race conditions if the scanner never fully started.
        } finally {
          try {
            scanner.clear()
          } catch {
            // Ignore cleanup failures when the scanner has already been disposed.
          }
        }
      })()
    }
  }, [open, scannerId])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
      <Surface variant="table" padding="lg" className="w-full max-w-lg border border-zinc-200 shadow-2xl dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Camera Scan</p>
            <h2 className="section-title">Scan via Camera</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Align the QR code inside the frame. Scans are processed in real time and routed through camera RBAC.
            </p>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="btn-ghost px-3 py-2 text-[10px]">
            Close
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-black dark:border-zinc-700">
          <div id={`camera-qr-${scannerId}`} className="min-h-[320px] w-full" />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {isProcessing ? 'Processing scan...' : 'Point the device camera at the asset QR.'}
          </p>
          {error && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} disabled={isProcessing} className="btn-primary">
            Back to Manual Entry
          </button>
        </div>
      </Surface>
    </div>
  )
}
