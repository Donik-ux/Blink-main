import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { verifyEmail } from '../api/auth.js';

export const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState('loading'); // loading | ok | err
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) { setState('err'); setErr('Нет токена'); return; }
    (async () => {
      try {
        await verifyEmail(token);
        setState('ok');
      } catch (e) {
        setErr(e.response?.data?.error || 'Не удалось подтвердить');
        setState('err');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[28px] text-center">
        {state === 'loading' && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-accent/30 border-t-accent animate-spin mb-4" />
            <p className="text-white/70">Проверяем токен...</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 size={64} className="text-success mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Email подтверждён!</h1>
            <p className="text-white/60 mb-6">Спасибо, теперь твой аккаунт защищён.</p>
            <Link to="/map" className="inline-block bg-white text-black px-6 py-3 rounded-2xl font-bold">На карту</Link>
          </>
        )}
        {state === 'err' && (
          <>
            <AlertCircle size={64} className="text-danger mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Ошибка</h1>
            <p className="text-white/60 mb-6">{err}</p>
            <Link to="/profile" className="inline-block bg-white text-black px-6 py-3 rounded-2xl font-bold">В профиль</Link>
          </>
        )}
      </div>
    </div>
  );
};
