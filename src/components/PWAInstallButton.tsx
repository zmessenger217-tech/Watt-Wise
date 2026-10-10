import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, Apple, CheckCircle2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'menu' }> = ({ variant = 'header' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [osName, setOsName] = useState<'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other'>('other');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect OS
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setOsName('ios');
    } else if (/android/.test(ua)) {
      setOsName('android');
    } else if (/win/.test(ua)) {
      setOsName('windows');
    } else if (/mac/.test(ua)) {
      setOsName('macos');
    } else if (/linux/.test(ua)) {
      setOsName('linux');
    } else {
      setOsName('other');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowModal(true);
    }
  };

  const getOSIcon = () => {
    switch (osName) {
      case 'ios':
      case 'macos':
        return <Apple className="w-4 h-4" />;
      case 'android':
        return <Smartphone className="w-4 h-4" />;
      case 'windows':
      case 'linux':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  const getOSLabel = () => {
    switch (osName) {
      case 'ios':
        return 'Install on iOS';
      case 'android':
        return 'Install Android App';
      case 'windows':
        return 'Install Windows App';
      case 'macos':
        return 'Install Mac App';
      case 'linux':
        return 'Install Linux App';
      default:
        return 'Download PWA App';
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          title="Install WattWise App on your device"
        >
          {getOSIcon()}
          <span>{getOSLabel()}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {getOSIcon()}
          <span>{getOSLabel()}</span>
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  {getOSIcon()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Install WattWise App</h3>
                  <p className="text-xs text-slate-500 capitalize">Detected Device: {osName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-700 space-y-2.5 leading-relaxed">
              {osName === 'ios' && (
                <>
                  <p className="font-semibold text-slate-900">How to install on iOS Safari:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Tap the <strong>Share</strong> button <span className="font-mono bg-white px-1.5 py-0.5 rounded border">⎋</span> in the Safari toolbar at the bottom of your screen.</li>
                    <li>Scroll down the share sheet options and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Confirm by tapping <strong>Add</strong> in the top-right corner. WattWise will appear on your home screen like a native app!</li>
                  </ol>
                </>
              )}

              {osName === 'android' && (
                <>
                  <p className="font-semibold text-slate-900">How to install on Android Chrome:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Tap the browser menu icon (<span className="font-mono bg-white px-1.5 py-0.5 rounded border">⋮</span>) in the top-right corner.</li>
                    <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong> from the menu.</li>
                    <li>Tap <strong>Install</strong> to add WattWise to your app drawer and home screen.</li>
                  </ol>
                </>
              )}

              {(osName === 'windows' || osName === 'macos' || osName === 'linux' || osName === 'other') && (
                <>
                  <p className="font-semibold text-slate-900">How to install on Desktop ({osName.toUpperCase()}) / Browser:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Look for the install icon (<span className="font-mono bg-white px-1.5 py-0.5 rounded border">⊕</span> or <span className="font-mono bg-white px-1.5 py-0.5 rounded border">💻</span>) in your browser&apos;s address bar right-hand side.</li>
                    <li>Alternatively, open your browser menu (<span className="font-mono bg-white px-1.5 py-0.5 rounded border">⋮</span> or <span className="font-mono bg-white px-1.5 py-0.5 rounded border">⋯</span>) and click <strong>Install WattWise...</strong>.</li>
                    <li>Enjoy offline access, desktop notifications, and standalone app window mode!</li>
                  </ol>
                </>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
