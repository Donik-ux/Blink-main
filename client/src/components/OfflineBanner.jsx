import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner = () => {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-warning text-black text-xs font-bold py-1.5 flex items-center justify-center gap-2 safe-top animate-slideUp">
      <WifiOff size={14} />
      <span>Нет связи — изменения сохранятся когда подключитесь</span>
    </div>
  );
};
