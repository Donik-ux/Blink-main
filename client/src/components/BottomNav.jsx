import { MapPin, Users, Bell, User, Trophy, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useNotificationStore } from '../store/notifStore.js';
import { useT } from '../i18n/index.js';

export const BottomNav = () => {
  const t = useT();
  const location = useLocation();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navItems = [
    { path: '/map', icon: MapPin, label: t('nav_map') },
    { path: '/friends', icon: Users, label: t('nav_friends') },
    { path: '/chats', icon: MessageCircle, label: t('nav_chats') },
    { path: '/steps', icon: Trophy, label: t('nav_steps') || 'Шаги' },
    { path: '/activity', icon: Bell, label: t('nav_activity'), notif: true },
    { path: '/profile', icon: User, label: t('nav_profile') },
  ];

  const handleNav = () => {
    if (navigator.vibrate) navigator.vibrate(8);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 px-3 pb-3 z-50 pointer-events-none safe-bottom">
      <nav className="bg-surface/85 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center h-[64px] px-1 w-full max-w-md mx-auto pointer-events-auto">
        {navItems.map(({ path, icon: Icon, label, notif }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              onClick={handleNav}
              className="press relative flex flex-col items-center justify-center flex-1 h-full group"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <div className={`flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-200 ${
                active ? 'bg-accent/15 text-accent shadow-[0_0_15px_rgba(0,217,255,0.2)]' : 'text-white/45 hover:text-white/80'
              }`}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {notif && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-surface flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold mt-0.5 transition-colors ${active ? 'text-accent' : 'text-white/40'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
