import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
};

export const applyTheme = (theme) => {
  try {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.dataset.theme = 'light';
    } else {
      root.classList.remove('light');
      root.dataset.theme = 'dark';
    }
  } catch {}
};

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => set((s) => {
        const next = s.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return { theme: next };
      }),
    }),
    {
      name: 'blink-theme',
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    }
  )
);
