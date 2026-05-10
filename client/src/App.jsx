import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { useThemeStore, applyTheme } from './store/themeStore.js';
import { useI18n } from './i18n/index.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { OfflineBanner } from './components/OfflineBanner.jsx';
import { AppRatingPrompt } from './components/AppRatingPrompt.jsx';
import { getProfile } from './api/profile.js';

const Onboarding = lazy(() => import('./pages/Onboarding.jsx').then((m) => ({ default: m.Onboarding })));
const Login = lazy(() => import('./pages/Login.jsx').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register.jsx').then((m) => ({ default: m.Register })));
const Map = lazy(() => import('./pages/Map.jsx').then((m) => ({ default: m.Map })));
const Friends = lazy(() => import('./pages/Friends.jsx').then((m) => ({ default: m.Friends })));
const Activity = lazy(() => import('./pages/Activity.jsx').then((m) => ({ default: m.Activity })));
const Profile = lazy(() => import('./pages/Profile.jsx').then((m) => ({ default: m.Profile })));
const ChatList = lazy(() => import('./pages/ChatList.jsx').then((m) => ({ default: m.ChatList })));
const ChatWindow = lazy(() => import('./pages/ChatWindow.jsx').then((m) => ({ default: m.ChatWindow })));
const Steps = lazy(() => import('./pages/Steps.jsx').then((m) => ({ default: m.Steps })));
const Stories = lazy(() => import('./pages/Stories.jsx').then((m) => ({ default: m.Stories })));
const Geofences = lazy(() => import('./pages/Geofences.jsx').then((m) => ({ default: m.Geofences })));
const Badges = lazy(() => import('./pages/Badges.jsx').then((m) => ({ default: m.Badges })));
const NewGroup = lazy(() => import('./pages/NewGroup.jsx').then((m) => ({ default: m.NewGroup })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx').then((m) => ({ default: m.ResetPassword })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx').then((m) => ({ default: m.VerifyEmail })));
const Privacy = lazy(() => import('./pages/Privacy.jsx').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Terms.jsx').then((m) => ({ default: m.Terms })));

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PageFallback = () => (
  <div className="w-full h-screen bg-bg flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
  </div>
);

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setLocale = useI18n((s) => s.setLocale);
  const onboardingDone = localStorage.getItem('onboarding_done');

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProfile();
        if (cancelled) return;
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          color: data.color,
          avatar: data.avatar,
          inviteCode: data.inviteCode,
          ghostMode: data.ghostMode,
          privacyMode: data.privacyMode,
          mood: data.mood,
          moodEmoji: data.moodEmoji,
          locale: data.locale,
          theme: data.theme,
          points: data.points,
          badges: data.badges,
        });
        // Применяем серверные настройки темы и языка
        if (data.theme && (data.theme === 'dark' || data.theme === 'light')) {
          setTheme(data.theme);
        }
        if (data.locale && ['ru', 'uz', 'en'].includes(data.locale)) {
          setLocale(data.locale);
        }
      } catch (e) {
        if (e?.response?.status === 401) logout();
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, setUser, logout, setTheme, setLocale]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OfflineBanner />
        {isAuthenticated && <AppRatingPrompt />}
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/onboarding" element={isAuthenticated ? <Navigate to="/map" replace /> : <Onboarding />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/map" replace /> : <Login />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/map" replace /> : <Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            <Route path="/map" element={<PrivateRoute><Map /></PrivateRoute>} />
            <Route path="/friends" element={<PrivateRoute><Friends /></PrivateRoute>} />
            <Route path="/activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/steps" element={<PrivateRoute><Steps /></PrivateRoute>} />
            <Route path="/chats" element={<PrivateRoute><ChatList /></PrivateRoute>} />
            <Route path="/chats/new-group" element={<PrivateRoute><NewGroup /></PrivateRoute>} />
            <Route path="/chat/:conversationId" element={<PrivateRoute><ChatWindow /></PrivateRoute>} />
            <Route path="/stories" element={<PrivateRoute><Stories /></PrivateRoute>} />
            <Route path="/geofences" element={<PrivateRoute><Geofences /></PrivateRoute>} />
            <Route path="/badges" element={<PrivateRoute><Badges /></PrivateRoute>} />

            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/map" replace />
                ) : onboardingDone ? (
                  <Navigate to="/login" replace />
                ) : (
                  <Navigate to="/onboarding" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
