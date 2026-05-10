import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Mail, Palette, Shield, Camera, Trash2, Smile, Globe, Moon, Sun, Bell, Battery, Download, Trophy, MapPin, AlertTriangle, Ban, ShieldCheck, QrCode } from 'lucide-react';
import { getProfile, updateProfile, getBlockedUsers, unblockUser, deleteAccount } from '../api/profile.js';
import { sendVerifyEmail } from '../api/auth.js';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../store/authStore.js';
import { useThemeStore } from '../store/themeStore.js';
import { useI18n } from '../i18n/index.js';
import { useT } from '../i18n/index.js';
import { useBatteryStore } from '../hooks/useBatterySaver.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';
import { GhostToggle } from '../components/GhostToggle.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { SavedLocations } from '../components/SavedLocations.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import { Toast } from '../components/Toast.jsx';
import { compressImage } from '../utils/image.js';
import { supportedLocales, localeLabel } from '../i18n/locales.js';

const COLORS = [
  '#7c3aed', '#db2777', '#d97706', '#059669', '#2563eb',
  '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#ea580c',
];

const MOOD_EMOJIS = ['😊', '😎', '🎉', '🏃', '💼', '😴', '✈️', '🍔', '❤️', '🔥', '💪', '🎮'];

const useInstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    const onBefore = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const prompt = async () => {
    if (!deferred) return false;
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === 'accepted';
  };
  return { canInstall: !!deferred && !installed, installed, prompt };
};

export const Profile = () => {
  const t = useT();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const battery = useBatteryStore((s) => ({ manual: s.manual, level: s.level }));
  const setBatterySaver = useBatteryStore((s) => s.setManual);
  const push = usePushNotifications();
  const install = useInstallPrompt();

  const [profile, setProfile] = useState(null);
  const [editName, setEditName] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(currentUser?.color || '#7c3aed');
  const [avatar, setAvatar] = useState(currentUser?.avatar || null);
  const [ghostMode, setGhostMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState('friends');
  const [mood, setMood] = useState('');
  const [moodEmoji, setMoodEmoji] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setNewName(data.name);
        setSelectedColor(data.color);
        setAvatar(data.avatar || null);
        setGhostMode(data.ghostMode);
        setPrivacyMode(data.privacyMode);
        setMood(data.mood || '');
        setMoodEmoji(data.moodEmoji || '');
      } catch (error) {
        console.error('Ошибка профиля:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveChanges = async () => {
    if (newName.trim().length < 2) {
      setToast({ message: t('error'), type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: newName, color: selectedColor, ghostMode, privacyMode, mood, moodEmoji });
      const updated = { ...profile, name: newName, color: selectedColor, ghostMode, privacyMode, mood, moodEmoji };
      setProfile(updated);
      setUser({ ...(currentUser || {}), ...updated, avatar });
      setEditName(false);
      setHasUnsaved(false);
      if (navigator.vibrate) navigator.vibrate(10);
      setToast({ message: t('save') + ' ✓', type: 'success' });
    } catch (error) {
      setToast({ message: error.response?.data?.error || t('error'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await compressImage(file, { maxSize: 256, quality: 0.85 });
      await updateProfile({ avatar: dataUrl });
      setAvatar(dataUrl);
      setProfile((p) => (p ? { ...p, avatar: dataUrl } : p));
      setUser({ ...(currentUser || {}), avatar: dataUrl });
    } catch (err) {
      setToast({ message: err?.response?.data?.error || t('error'), type: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!avatar) return;
    if (!window.confirm(t('profile_avatar_remove') + '?')) return;
    try {
      await updateProfile({ avatar: null });
      setAvatar(null);
      setProfile((p) => (p ? { ...p, avatar: null } : p));
      setUser({ ...(currentUser || {}), avatar: null });
    } catch {
      setToast({ message: t('error'), type: 'error' });
    }
  };

  const onChangeTheme = async (next) => {
    setTheme(next);
    try { await updateProfile({ theme: next }); } catch {}
  };
  const onChangeLocale = async (next) => {
    setLocale(next);
    try { await updateProfile({ locale: next }); } catch {}
  };

  const togglePush = async () => {
    if (push.subscribed) await push.disable();
    else {
      const ok = await push.enable();
      if (!ok) setToast({ message: t('error'), type: 'error' });
    }
  };

  const onInstall = async () => {
    const ok = await install.prompt();
    if (ok) setToast({ message: 'Установлено', type: 'success' });
  };

  const markChanged = () => setHasUnsaved(true);

  const handleLogout = () => {
    if (window.confirm(t('profile_logout') + '?')) {
      logout();
      navigate('/login');
    }
  };

  if (loading || !profile) {
    return (
      <div className="w-full h-screen bg-bg flex items-center justify-center safe-top">
        <p className="text-white/50 font-medium tracking-widest uppercase text-xs animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-32 text-white relative safe-top">
      <div className="fixed top-0 inset-x-0 h-48 bg-gradient-to-b from-accent/10 to-transparent pointer-events-none" />

      {/* Hero */}
      <div className="px-4 pt-6 pb-4 sm:pt-10 text-center relative z-10 animate-slideUp">
        <div className="flex justify-center mb-3 relative">
          <div className="relative">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="press relative block rounded-full">
              <Avatar name={newName} color={selectedColor} size="lg" avatar={avatar} />
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-accent text-black flex items-center justify-center shadow-lg ring-2 ring-bg">
                <Camera size={14} />
              </div>
            </button>
            {avatar && (
              <button onClick={handleAvatarRemove} className="press absolute -top-1 -left-1 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow-lg ring-2 ring-bg">
                <Trash2 size={12} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
          </div>
        </div>

        {editName ? (
          <div className="flex gap-2 max-w-[260px] mx-auto mb-2">
            <input type="text" value={newName} onChange={(e) => { setNewName(e.target.value); markChanged(); }} className="flex-1 bg-black/50 border border-accent/50 rounded-xl px-3 py-2.5 text-white text-center font-bold" autoFocus />
            <button onClick={handleSaveChanges} disabled={saving} className="press bg-emerald-500/20 text-emerald-400 px-3 rounded-xl"><Check size={20} /></button>
          </div>
        ) : (
          <div className="mb-1.5 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{profile.name}</h1>
            <button onClick={() => setEditName(true)} className="press p-1.5 bg-white/5 rounded-full"><Edit2 size={14} className="text-white/60" /></button>
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          <Mail size={12} className="text-accent" />
          <p className="text-white/60 text-[11px] font-semibold tracking-wider">{profile.email}</p>
        </div>
        {moodEmoji || mood ? (
          <p className="mt-2 text-white/80 text-sm">{moodEmoji} {mood}</p>
        ) : null}
      </div>

      {/* Stats row */}
      <div className="px-4 max-w-md mx-auto relative z-10">
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <button onClick={() => navigate('/friends')} className="press bg-surface/40 border border-white/5 rounded-2xl p-3 text-center">
            <p className="text-2xl font-extrabold text-accent leading-none">{profile.friendsCount}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase mt-1">Друзей</p>
          </button>
          <button onClick={() => navigate('/badges')} className="press bg-surface/40 border border-white/5 rounded-2xl p-3 text-center">
            <p className="text-2xl font-extrabold text-accent2 leading-none">{profile.points || 0}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase mt-1">Очки</p>
          </button>
          <button onClick={() => navigate('/badges')} className="press bg-surface/40 border border-white/5 rounded-2xl p-3 text-center">
            <p className="text-2xl font-extrabold text-accent3 leading-none">{(profile.badges || []).length}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase mt-1">Бейджи</p>
          </button>
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-3 relative z-10">
        {/* Mood */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Smile size={14} className="text-accent" />
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">{t('profile_mood')}</p>
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {MOOD_EMOJIS.map((e) => (
              <button key={e} onClick={() => { setMoodEmoji(e); markChanged(); }} className={`text-lg w-9 h-9 rounded-full flex items-center justify-center ${moodEmoji === e ? 'bg-accent' : 'bg-white/5'}`}>{e}</button>
            ))}
            <button onClick={() => { setMoodEmoji(''); markChanged(); }} className="text-xs px-2 rounded-full bg-white/5 text-white/60">×</button>
          </div>
          <input value={mood} onChange={(e) => { setMood(e.target.value); markChanged(); }} placeholder={t('profile_mood_placeholder')} maxLength={80} />
        </section>

        {/* Theme */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            {theme === 'dark' ? <Moon size={14} className="text-accent" /> : <Sun size={14} className="text-accent" />}
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">{t('profile_theme')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onChangeTheme('dark')} className={`press rounded-xl py-2 text-sm font-medium ${theme === 'dark' ? 'bg-accent text-black' : 'bg-white/5 text-white'}`}>
              <Moon size={14} className="inline mr-1" />{t('profile_theme_dark')}
            </button>
            <button onClick={() => onChangeTheme('light')} className={`press rounded-xl py-2 text-sm font-medium ${theme === 'light' ? 'bg-accent text-black' : 'bg-white/5 text-white'}`}>
              <Sun size={14} className="inline mr-1" />{t('profile_theme_light')}
            </button>
          </div>
        </section>

        {/* Language */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-accent" />
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">{t('profile_language')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {supportedLocales.map((l) => (
              <button key={l} onClick={() => onChangeLocale(l)} className={`press rounded-xl py-2 text-sm font-medium ${locale === l ? 'bg-accent text-black' : 'bg-white/5 text-white'}`}>
                {localeLabel[l]}
              </button>
            ))}
          </div>
        </section>

        {/* Push */}
        {push.supported && (
          <section className="glass rounded-2xl p-4 flex items-center gap-3">
            <Bell size={18} className="text-accent" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{t('profile_push')}</p>
              <p className="text-white/40 text-xs">{push.subscribed ? 'Активны' : 'Выключены'}</p>
            </div>
            <button onClick={togglePush} disabled={push.busy} className={`press rounded-full px-3 py-1.5 text-sm font-bold ${push.subscribed ? 'bg-white/10 text-white' : 'bg-accent text-black'}`}>
              {push.subscribed ? t('profile_push_disable') : t('profile_push_enable')}
            </button>
          </section>
        )}

        {/* Battery saver */}
        <section className="glass rounded-2xl p-4 flex items-center gap-3">
          <Battery size={18} className="text-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">{t('profile_battery_saver')}</p>
            <p className="text-white/40 text-xs">{t('profile_battery_saver_desc')}{battery.level != null ? ` • ${Math.round(battery.level * 100)}%` : ''}</p>
          </div>
          <button onClick={() => setBatterySaver(!battery.manual)} className={`press w-12 h-6 rounded-full transition-all ${battery.manual ? 'bg-accent' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${battery.manual ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </section>

        {/* Install */}
        {install.canInstall && (
          <button onClick={onInstall} className="press w-full glass rounded-2xl p-4 flex items-center gap-3">
            <Download size={18} className="text-accent" />
            <span className="flex-1 text-left text-white text-sm font-semibold">{t('profile_install_app')}</span>
          </button>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => navigate('/geofences')} className="press glass rounded-2xl p-3 text-center">
            <MapPin size={18} className="mx-auto text-accent mb-1" />
            <span className="text-white text-xs font-medium">{t('profile_geofences')}</span>
          </button>
          <button onClick={() => navigate('/badges')} className="press glass rounded-2xl p-3 text-center">
            <Trophy size={18} className="mx-auto text-accent mb-1" />
            <span className="text-white text-xs font-medium">{t('profile_badges')}</span>
          </button>
        </div>

        {/* Color */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={14} className="text-accent" />
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">{t('profile_color')}</p>
          </div>
          <div className="flex flex-wrap gap-2.5 justify-between">
            {COLORS.map((color) => (
              <button key={color} onClick={() => { setSelectedColor(color); markChanged(); }} className={`press w-9 h-9 rounded-full transition-all ${selectedColor === color ? 'scale-110 ring-2 ring-white/80' : 'opacity-60'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <GhostToggle enabled={ghostMode} onChange={(val) => { setGhostMode(val); markChanged(); }} />
        </section>

        <section className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-accent" />
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">{t('profile_privacy')}</p>
          </div>
          <div className="space-y-1">
            {[
              { value: 'friends', label: t('profile_privacy_friends') },
              { value: 'everyone', label: t('profile_privacy_everyone') },
            ].map(({ value, label }) => (
              <label key={value} className="press flex items-center justify-between cursor-pointer p-2.5 -mx-1 rounded-xl">
                <span className="text-white/85 text-sm font-medium">{label}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${privacyMode === value ? 'border-accent' : 'border-white/20'}`}>
                  {privacyMode === value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </div>
                <input type="radio" name="privacy" value={value} checked={privacyMode === value} onChange={(e) => { setPrivacyMode(e.target.value); markChanged(); }} className="hidden" />
              </label>
            ))}
          </div>
        </section>

        <SavedLocations myLocation={profile.lastLocation} />

        <SecuritySection profile={profile} setToast={setToast} onLogout={logout} />

        <button onClick={handleLogout} className="press w-full bg-black/50 border border-red-500/30 text-red-400 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 mt-2">
          <LogOut size={16} />
          <span className="text-sm">{t('profile_logout')}</span>
        </button>
      </div>

      {hasUnsaved && (
        <div className="fixed bottom-24 left-0 right-0 px-4 z-40 animate-slideUp pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button onClick={handleSaveChanges} disabled={saving} className="press w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white py-3.5 rounded-2xl font-bold shadow-[0_10px_30px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2">
              <Check size={18} />
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

// ---------- Безопасность: QR, email-верификация, блокированные, удаление аккаунта ----------
const SecuritySection = ({ profile, setToast, onLogout }) => {
  const [showQR, setShowQR] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePass, setDeletePass] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (showBlocked) {
      getBlockedUsers().then(setBlocked).catch(() => {});
    }
  }, [showBlocked]);

  const inviteUrl = `${window.location.origin}/register?invite=${profile.inviteCode || ''}`;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await sendVerifyEmail();
      setToast({ message: 'Письмо отправлено. Проверьте почту.', type: 'success' });
    } catch (e) {
      setToast({ message: e.response?.data?.error || 'Ошибка', type: 'error' });
    } finally { setVerifying(false); }
  };

  const handleUnblock = async (id) => {
    try {
      await unblockUser(id);
      setBlocked((prev) => prev.filter((u) => String(u.id) !== String(id)));
    } catch (e) {
      setToast({ message: 'Ошибка', type: 'error' });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(deletePass || undefined);
      onLogout();
      setToast({ message: 'Аккаунт удалён', type: 'success' });
    } catch (e) {
      setToast({ message: e.response?.data?.error || 'Ошибка', type: 'error' });
      setDeleting(false);
    }
  };

  return (
    <>
      {/* QR-код приглашения */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QrCode size={20} className="text-accent" />
            <div>
              <p className="text-white font-semibold">QR-код приглашения</p>
              <p className="text-white/50 text-xs">Покажите другу, чтобы добавить</p>
            </div>
          </div>
          <button onClick={() => setShowQR((v) => !v)} className="press text-accent text-sm font-medium">
            {showQR ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {showQR && profile.inviteCode && (
          <div className="bg-white p-4 rounded-2xl flex flex-col items-center gap-3">
            <QRCodeSVG value={inviteUrl} size={180} level="M" />
            <p className="text-black font-mono font-bold tracking-widest">{profile.inviteCode}</p>
          </div>
        )}
      </section>

      {/* Email verification */}
      {profile.email && !profile.emailVerified && (
        <section className="card flex items-center gap-3 border-warning/30 bg-warning/5">
          <AlertTriangle size={20} className="text-warning" />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">Email не подтверждён</p>
            <p className="text-white/50 text-xs">Подтвердите чтобы защитить аккаунт</p>
          </div>
          <button onClick={handleVerify} disabled={verifying} className="press bg-warning text-black px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50">
            {verifying ? '...' : 'Отправить'}
          </button>
        </section>
      )}
      {profile.email && profile.emailVerified && (
        <section className="card flex items-center gap-3 border-success/30 bg-success/5">
          <ShieldCheck size={20} className="text-success" />
          <p className="text-white/80 text-sm flex-1">Email подтверждён</p>
        </section>
      )}

      {/* Заблокированные */}
      <section className="card space-y-3">
        <button onClick={() => setShowBlocked((v) => !v)} className="press w-full flex items-center gap-3">
          <Ban size={20} className="text-white/60" />
          <div className="flex-1 text-left">
            <p className="text-white font-semibold">Заблокированные</p>
            <p className="text-white/50 text-xs">{blocked.length || 0} пользователей</p>
          </div>
          <span className="text-accent text-sm">{showBlocked ? '▲' : '▼'}</span>
        </button>
        {showBlocked && (
          blocked.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-3">Список пуст</p>
          ) : (
            <div className="space-y-2">
              {blocked.map((u) => (
                <div key={u.id} className="flex items-center gap-3 bg-black/30 rounded-xl p-2.5">
                  <Avatar name={u.name} color={u.color} avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{u.name}</p>
                    <p className="text-white/40 text-xs truncate">{u.email}</p>
                  </div>
                  <button onClick={() => handleUnblock(u.id)} className="press text-accent text-xs font-medium">
                    Разблок.
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* Удаление аккаунта */}
      <section className="card border-danger/30 bg-danger/5 space-y-3">
        <div className="flex items-center gap-3">
          <Trash2 size={20} className="text-danger" />
          <div>
            <p className="text-white font-semibold">Опасная зона</p>
            <p className="text-white/50 text-xs">Удаление безвозвратно</p>
          </div>
        </div>
        {!deleteOpen ? (
          <button onClick={() => setDeleteOpen(true)} className="press w-full bg-danger/20 border border-danger/40 text-danger py-2.5 rounded-xl text-sm font-bold">
            Удалить аккаунт
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-white/80 text-sm">
              Все ваши данные (друзья, чаты, локации, истории, чек-ины, бейджи) будут удалены навсегда.
            </p>
            {profile.hasPassword !== false && (
              <input
                type="password"
                value={deletePass}
                onChange={(e) => setDeletePass(e.target.value)}
                placeholder="Подтвердите паролем"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-danger"
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setDeleteOpen(false); setDeletePass(''); }} className="press bg-white/10 text-white py-2 rounded-xl text-sm font-medium">
                Отмена
              </button>
              <button onClick={handleDelete} disabled={deleting} className="press bg-danger text-white py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                {deleting ? 'Удаляем...' : 'Удалить навсегда'}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
};
