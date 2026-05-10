import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { getBadges } from '../api/badges.js';
import { useT } from '../i18n/index.js';

export const Badges = () => {
  const t = useT();
  const navigate = useNavigate();
  const [data, setData] = useState({ badges: [], points: 0 });

  useEffect(() => {
    (async () => { try { setData(await getBadges()); } catch {} })();
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-24 safe-top">
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="press p-2 -ml-1"><ArrowLeft size={22} className="text-accent" /></button>
          <h1 className="text-xl font-bold text-white flex-1">{t('profile_badges')}</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="card mb-4 flex items-center gap-3 bg-gradient-to-br from-accent/10 to-accent3/10 border-accent/30">
          <Trophy size={32} className="text-accent" />
          <div>
            <p className="text-white/60 text-sm">{t('profile_points')}</p>
            <p className="text-3xl font-bold text-accent">{data.points || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {data.badges?.map((b) => (
            <div key={b.id} className={`card text-center transition-all ${b.earned ? 'bg-gradient-to-br from-accent/15 to-accent3/15 border-accent/40' : 'opacity-50 grayscale'}`}>
              <div className="text-4xl mb-2">{b.emoji}</div>
              <p className="text-white font-bold text-sm">{b.title}</p>
              <p className="text-white/50 text-xs mt-1">{b.desc}</p>
              {b.earned && <p className="text-accent text-[10px] font-bold mt-2">✓ Открыто</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
