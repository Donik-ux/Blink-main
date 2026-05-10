import { useState, useEffect } from 'react';
import { Share2, X } from 'lucide-react';
import { setLiveShare } from '../api/profile.js';

const OPTIONS = [
  { mins: 15, label: '15 мин' },
  { mins: 60, label: '1 час' },
  { mins: 480, label: '8 часов' },
];

export const LiveShareButton = ({ initialUntil }) => {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(initialUntil ? new Date(initialUntil) : null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = until && until.getTime() > Date.now();

  const remaining = active
    ? (() => {
        const ms = until.getTime() - Date.now();
        const m = Math.floor(ms / 60_000);
        if (m >= 60) return `${Math.floor(m / 60)}ч ${m % 60}м`;
        return `${m}м`;
      })()
    : null;

  const start = async (mins) => {
    setBusy(true);
    try {
      const r = await setLiveShare(mins);
      setUntil(r.liveShareUntil ? new Date(r.liveShareUntil) : null);
      setOpen(false);
    } finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await setLiveShare(0);
      setUntil(null);
      setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`press flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md border ${
          active
            ? 'bg-success/20 border-success/40 text-success'
            : 'bg-surface/70 border-white/10 text-white/80'
        }`}
        aria-label="Live share"
        title="Live share"
      >
        <Share2 size={14} />
        {active ? `Live ${remaining}` : 'Live'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-surface border border-white/10 rounded-3xl p-5 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">Поделиться локацией</h3>
                <p className="text-white/50 text-xs mt-1">Друзья будут видеть вас точно до конца таймера</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((o) => (
                <button
                  key={o.mins}
                  onClick={() => start(o.mins)}
                  disabled={busy}
                  className="press bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 text-white text-sm font-medium disabled:opacity-50"
                >
                  {o.label}
                </button>
              ))}
            </div>
            {active && (
              <button
                onClick={stop}
                disabled={busy}
                className="press w-full mt-3 bg-danger/20 border border-danger/40 text-danger py-3 rounded-2xl font-bold text-sm"
              >
                Остановить (осталось {remaining})
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
