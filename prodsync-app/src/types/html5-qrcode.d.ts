declare module 'html5-qrcode' {
  export enum Html5QrcodeScannerState {
    NOT_STARTED = 1,
    SCANNING = 2,
    PAUSED = 3,
  }

  export enum Html5QrcodeSupportedFormats {
    QR_CODE = 0,
  }

  export type Html5QrcodeCameraScanConfig = {
    fps?: number
    qrbox?: { width: number; height: number }
    formatsToSupport?: Html5QrcodeSupportedFormats[]
  }

  export class Html5Qrcode {
    constructor(
      elementId: string,
      options?: {
        formatsToSupport?: Html5QrcodeSupportedFormats[]
        verbose?: boolean
      },
    )

    start(
      cameraIdOrConfig: string | { facingMode: string | { exact: string } },
      configuration: Html5QrcodeCameraScanConfig,
      qrCodeSuccessCallback: (decodedText: string, decodedResult: unknown) => void,
      qrCodeErrorCallback?: (errorMessage: string, error: unknown) => void,
    ): Promise<void>

    stop(): Promise<void>
    clear(): void
    getState(): Html5QrcodeScannerState
  }
}
