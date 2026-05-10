import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { login } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';
import { Toast } from '../components/Toast.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';

export const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const setAuthState = useAuthStore();

  const validateForm = () => {
    const newErrors = {};

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await login(formData.email, formData.password);

      setAuthState.setTokens({ token: response.token, refreshToken: response.refreshToken });
      setAuthState.setUser(response.user);

      setToast({ message: 'Вход выполнен!', type: 'success' });
      setTimeout(() => navigate('/map'), 1000);
    } catch (error) {
      console.error('Login error:', error);
      const errorMsg =
        error.response?.data?.error ||
        (error.message === 'Network Error' ? 'Нет связи с сервером' : error.message) ||
        'Ошибка входа';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent3/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md bg-surface/40 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="text-center mb-7 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent3 shadow-[0_0_20px_rgba(0,217,255,0.4)] mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Blink</h1>
          <p className="text-accent text-sm font-medium tracking-wide uppercase">Локатор Друзей</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 flex flex-col items-center w-full">
          {/* Email */}
          <div className="w-full group">
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Mail size={14} className="text-accent group-focus-within:text-white transition-colors" />
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className={`w-full bg-black/40 border ${
                  errors.email ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-white/10'
                } rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
              />
            </div>
            {errors.email && (
              <p className="text-red-400 text-xs mt-2 pl-2 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.email}
              </p>
            )}
          </div>

          {/* Пароль */}
          <div className="w-full group">
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Lock size={14} className="text-accent group-focus-within:text-white transition-colors" />
              Пароль
            </label>
            <div className="relative">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••"
                className={`w-full bg-black/40 border ${
                  errors.password ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-white/10'
                } rounded-2xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
              />
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-2 pl-2 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.password}
              </p>
            )}
          </div>

          <div className="w-full flex justify-end">
            <Link to="/forgot-password" className="text-white/50 text-xs font-medium hover:text-white transition-colors">
              Забыл пароль?
            </Link>
          </div>

          {/* Кнопка входа */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-white text-black py-4 rounded-2xl font-bold transition-all disabled:opacity-70 mt-4 flex justify-between items-center px-6 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            <span className="relative z-10 text-[15px]">{loading ? 'Вход...' : 'Войти в систему'}</span>
            <div className="relative z-10 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
               <ArrowRight size={16} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-accent to-accent3 opacity-0 group-hover:opacity-20 transition-opacity" />
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/40 text-xs uppercase tracking-wider">или</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <GoogleSignInButton onError={(msg) => setToast({ message: msg, type: 'error' })} />

        <div className="w-full h-px bg-white/10 my-6"></div>

        <p className="text-center text-white/50 text-sm font-medium">
          Новый пользователь?{' '}
          <Link to="/register" className="text-white hover:text-accent font-semibold transition-colors">
            Создать аккаунт
          </Link>
        </p>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

