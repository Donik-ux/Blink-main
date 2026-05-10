import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';

const KEY = 'app_rating_state';
const MIN_OPENS = 8;

export const AppRatingPrompt = () => {
  const [show, setShow] = useState(false);
  const [hover, setHover] = useState(0);
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const state = raw ? JSON.parse(raw) : { opens: 0, dismissed: false, rated: false };
      state.opens = (state.opens || 0) + 1;
      if (state.dismissed || state.rated) {
        localStorage.setItem(KEY, JSON.stringify(state));
        return;
      }
      if (state.opens >= MIN_OPENS) {
        setTimeout(() => setShow(true), 4000);
      }
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, []);

  const dismiss = () => {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.dismissed = true;
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
    setShow(false);
  };

  const submit = (n) => {
    setPicked(n);
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.rated = true;
      state.rating = n;
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
    setTimeout(() => setShow(false), 1500);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-slideUp pointer-events-none">
      <div className="max-w-md mx-auto bg-surface border border-white/10 rounded-3xl p-4 shadow-xl pointer-events-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-white font-bold">Нравится Blink?</p>
            <p className="text-white/60 text-xs mt-0.5">Поставьте оценку — это поможет другим</p>
          </div>
          <button onClick={dismiss} className="text-white/40 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
        {picked === 0 ? (
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => submit(n)}
                className="press p-1.5"
                aria-label={`${n} stars`}
              >
                <Star size={28} className={`${(hover || picked) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-success font-medium">Спасибо! ⭐ {picked}/5</p>
        )}
      </div>
    </div>
  );
};
