import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:right-auto z-40 flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-bottom duration-300">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Offline Mode — All financial and harvest records saved locally</span>
    </div>
  );
};
