import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { resetPassword } from '../api/auth.js';
import { Toast } from '../components/Toast.jsx';

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!token) setErr('Нет токена в ссылке');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setErr('Минимум 6 символов'); return; }
    if (password !== confirm) { setErr('Пароли не совпадают'); return; }
    setErr('');
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) {
      setToast({ message: e.response?.data?.error || 'Ошибка сброса', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/40 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[28px]">
        <h1 className="text-2xl font-bold text-white mb-6">Новый пароль</h1>

        {done ? (
          <div className="text-center py-8">
            <CheckCircle2 size={56} className="text-success mx-auto mb-3" />
            <p className="text-white font-medium">Пароль обновлён!</p>
            <p className="text-white/50 text-sm mt-2">Сейчас перенаправим на вход...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                <Lock size={14} className="text-accent" /> Новый пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                <Lock size={14} className="text-accent" /> Подтверждение
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-accent"
              />
            </div>
            {err && (
              <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{err}</p>
            )}
            <button type="submit" disabled={loading || !token} className="w-full bg-white text-black py-4 rounded-2xl font-bold disabled:opacity-70">
              {loading ? 'Обновляем...' : 'Сохранить пароль'}
            </button>
            <Link to="/login" className="block text-center text-white/60 text-sm hover:text-white">К входу</Link>
          </form>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};
