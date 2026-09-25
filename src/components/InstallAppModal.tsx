import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  WifiOff,
  Sparkles,
  ExternalLink,
  ChevronRight,
  FolderArchive
} from 'lucide-react';

interface InstallAppModalProps {
  onClose: () => void;
  onOpenAndroidSource?: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  onClose,
  onOpenAndroidSource
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [activeMethod, setActiveMethod] = useState<'pwa' | 'apk'>('pwa');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 240,
        margin: 1,
        color: {
          dark: '#1b5e20',
          light: '#ffffff'
        }
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [currentUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-xl">
              <Smartphone className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Install on Your Phone</h2>
              <p className="text-xs text-emerald-200">
                Run Farm Finance on Android or iOS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            onClick={() => setActiveMethod('pwa')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeMethod === 'pwa'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Instant Install (PWA Mobile App)
          </button>
          <button
            onClick={() => setActiveMethod('apk')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeMethod === 'apk'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-slate-600" />
            Native Android APK (Gradle/Studio)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {activeMethod === 'pwa' ? (
            <>
              {/* Status / Direct action banner */}
              {isInstalled || installSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                    <Check className="w-5 h-5 font-bold" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Already Running as Installed App</h4>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Farm Finance is running in standalone mode with full offline storage enabled.
                    </p>
                  </div>
                </div>
              ) : isInstallable ? (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-slate-900 text-sm">
                        One-Click Install Ready
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">
                      Android & Chrome
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-3">
                    Click the button below to add Farm Finance directly to your home screen and app launcher.
                  </p>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition text-xs"
                  >
                    <Download className="w-4 h-4" />
                    Install Farm Finance to Phone / Device
                  </button>
                </div>
              ) : null}

              {/* QR Code to open on mobile phone */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col sm:flex-row items-center gap-4">
                {qrCodeUrl && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0 text-center">
                    <img
                      src={qrCodeUrl}
                      alt="Scan to open on phone"
                      className="w-32 h-32 object-contain mx-auto"
                    />
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block mt-1">
                      Scan with Phone Camera
                    </span>
                  </div>
                )}
                <div className="space-y-2 flex-1 text-left">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    Step 1: Open on Your Smartphone
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Point your Android or iPhone camera at this QR code, or copy the direct link to open in your mobile browser:
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={currentUrl}
                      className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-700 select-all"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1 shrink-0 transition"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Platform-specific instructions */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Step 2: Add to Home Screen
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Android Chrome */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="text-base">🤖</span>
                      <span>Android (Chrome / Samsung)</span>
                    </div>
                    <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 pl-1">
                      <li>Open the link in <strong>Chrome</strong>.</li>
                      <li>Look for the <strong>"Install app"</strong> banner at the bottom, or tap the three dots <strong>(⋮)</strong> menu.</li>
                      <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                      <li>The app icon is placed on your home screen!</li>
                    </ol>
                  </div>

                  {/* iOS Safari */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="text-base">🍏</span>
                      <span>iPhone / iPad (Safari)</span>
                    </div>
                    <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 pl-1">
                      <li>Open the link in <strong>Safari</strong>.</li>
                      <li>Tap the <strong>Share button</strong> <span className="text-slate-800 font-bold">⎋</span> (rectangle with up arrow) in the toolbar.</li>
                      <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                      <li>Tap <strong>"Add"</strong> in top right.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Offline highlight */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] space-y-0.5">
                  <span className="font-bold">100% Offline Capability:</span>
                  <p className="text-amber-800 leading-tight">
                    Once installed, Farm Finance caches all assets and uses local IndexedDB storage. You can record rice and copra sales, harvests, payments, and expenses out in the field without any cellular signal or internet connection.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Native Android APK Tab */
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-emerald-700 text-white rounded-lg shrink-0">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Native Kotlin & Compose Android App</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    The complete standalone native Android project is included right inside this app repository under <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">/android/</code>.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-bold text-slate-900 text-xs">How to Build the Android APK:</h5>
                <div className="space-y-2 text-[11px] text-slate-700">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900">Method 1: Android Studio (Recommended)</span>
                    <ol className="list-decimal list-inside text-slate-600 mt-1 space-y-0.5">
                      <li>Download the project zip using the button below.</li>
                      <li>Open <strong>Android Studio</strong> and select <strong>Open Project</strong> → select the extracted folder.</li>
                      <li>Click <strong>Build → Build Bundle(s) / APK(s) → Build APK(s)</strong>.</li>
                      <li>Transfer the generated <code className="font-mono bg-white px-1">app-debug.apk</code> to your phone and tap to install!</li>
                    </ol>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900">Method 2: Command Line (Gradle)</span>
                    <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto">
cd android && ./gradlew assembleDebug
                    </pre>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Output APK: <code className="font-mono">app/build/outputs/apk/debug/app-debug.apk</code>
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900">Method 3: GitHub Actions (Cloud Build)</span>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      Push the project to GitHub and use the pre-configured workflow in <code className="font-mono bg-white px-1">.github/workflows/android.yml</code>. GitHub will build the signed APK automatically and provide a download link on every push.
                    </p>
                  </div>
                </div>
              </div>

              {onOpenAndroidSource && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAndroidSource();
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition text-xs"
                >
                  <FolderArchive className="w-4 h-4" />
                  Open Android Studio Project Browser & Download Zip
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted local storage • Room / IndexedDB</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
