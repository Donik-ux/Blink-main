import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { locales, supportedLocales } from './locales.js';

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const detectLocale = () => {
  try {
    const lang = (navigator.language || 'ru').toLowerCase();
    if (lang.startsWith('uz')) return 'uz';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ru')) return 'ru';
  } catch {}
  return 'ru';
};

export const useI18n = create(
  persist(
    (set, get) => ({
      locale: detectLocale(),
      setLocale: (locale) => {
        if (!supportedLocales.includes(locale)) return;
        set({ locale });
      },
    }),
    {
      name: 'blink-locale',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);

// t(key, params) — простой template: {n} → params.n
export const t = (key, params) => {
  const locale = useI18n.getState().locale || 'ru';
  const dict = locales[locale] || locales.ru;
  let str = dict[key] ?? locales.ru[key] ?? key;
  if (params && typeof str === 'string') {
    str = str.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
  }
  return str;
};

// React hook — re-render при смене локали
import { useSyncExternalStore } from 'react';
export const useT = () => {
  useSyncExternalStore(
    (cb) => useI18n.subscribe(cb),
    () => useI18n.getState().locale
  );
  return t;
};
