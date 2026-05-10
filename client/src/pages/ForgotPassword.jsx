import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../api/auth.js';
import { Toast } from '../components/Toast.jsx';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Ошибка', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/40 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[28px]">
        <Link to="/login" className="press inline-flex items-center gap-2 text-white/60 mb-4 hover:text-white">
          <ArrowLeft size={18} /> Назад
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Сброс пароля</h1>
        <p className="text-white/60 text-sm mb-6">Введите email — отправим ссылку для установки нового пароля.</p>

        {sent ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">📧</div>
            <p className="text-white font-medium mb-2">Если email зарегистрирован — письмо отправлено.</p>
            <p className="text-white/50 text-sm">Проверьте почту (включая «Спам»). Ссылка работает 1 час.</p>
            <Link to="/login" className="inline-block mt-6 text-accent font-medium hover:underline">К входу</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                <Mail size={14} className="text-accent" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold disabled:opacity-70"
            >
              {loading ? 'Отправляем...' : 'Отправить ссылку'}
            </button>
          </form>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};
