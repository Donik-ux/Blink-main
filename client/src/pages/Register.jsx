import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { register } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';
import { Toast } from '../components/Toast.jsx';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';

export const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const setAuthState = useAuthStore();

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim() || formData.name.length < 2) {
      newErrors.name = 'Имя должно быть не менее 2 символов';
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
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
      const response = await register(
        formData.name,
        formData.email,
        formData.password,
        formData.confirmPassword
      );

      setAuthState.setTokens({ token: response.token, refreshToken: response.refreshToken });
      setAuthState.setUser(response.user);

      setToast({ message: 'Аккаунт создан!', type: 'success' });
      setTimeout(() => navigate('/map'), 1000);
    } catch (error) {
      console.error('Register error:', error);
      const errorMsg =
        error.response?.data?.error ||
        (error.message === 'Network Error' ? 'Нет связи с сервером' : error.message) ||
        'Ошибка регистрации';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center p-4 overflow-hidden py-12">
      {/* Animated Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent2/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md bg-surface/40 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-[0_0_40px_rgba(0,0,0,0.5)] my-auto">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent2 to-accent shadow-[0_0_20px_rgba(255,0,110,0.4)] mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Регистрация</h1>
          <p className="text-accent text-sm font-medium tracking-wide">Присоединяйся к Blink</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center w-full">
          {/* Имя */}
          <div className="w-full group">
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <User size={14} className="text-accent group-focus-within:text-white transition-colors" />
              Имя
            </label>
            <div className="relative">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Иван Петров"
                className={`w-full bg-black/40 border ${
                  errors.name ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-white/10'
                } rounded-2xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
              />
            </div>
            {errors.name && (
              <p className="text-red-400 text-xs mt-2 pl-2 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.name}
              </p>
            )}
          </div>

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
                } rounded-2xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
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
                } rounded-2xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
              />
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-2 pl-2 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.password}
              </p>
            )}
          </div>

          {/* Подтверждение пароля */}
          <div className="w-full group">
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
              <Lock size={14} className="text-accent group-focus-within:text-white transition-colors" />
              Подтверждение
            </label>
            <div className="relative">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••"
                className={`w-full bg-black/40 border ${
                  errors.confirmPassword ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-white/10'
                } rounded-2xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(0,217,255,0.2)] transition-all`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-2 pl-2 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Кнопка регистрации */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-white text-black py-4 rounded-2xl font-bold transition-all disabled:opacity-70 mt-6 flex justify-between items-center px-6 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            <span className="relative z-10 text-[15px]">{loading ? 'Создание...' : 'Создать аккаунт'}</span>
            <div className="relative z-10 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
               <ArrowRight size={16} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-accent to-accent2 opacity-0 group-hover:opacity-20 transition-opacity" />
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/40 text-xs uppercase tracking-wider">или</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <GoogleSignInButton onError={(msg) => setToast({ message: msg, type: 'error' })} />

        <p className="text-center text-white/40 text-[11px] mt-5 leading-relaxed">
          Создавая аккаунт, вы соглашаетесь с{' '}
          <Link to="/terms" className="text-white/70 hover:text-white">Условиями</Link>{' '}и{' '}
          <Link to="/privacy" className="text-white/70 hover:text-white">Политикой конфиденциальности</Link>.
        </p>

        <div className="w-full h-px bg-white/10 my-6"></div>

        {/* Ссылка на вход */}
        <p className="text-center text-white/50 text-sm font-medium">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-white hover:text-accent font-semibold transition-colors">
            Войти
          </Link>
        </p>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

