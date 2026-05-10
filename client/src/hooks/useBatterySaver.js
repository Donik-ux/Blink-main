import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect } from 'react';

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
};

export const useBatteryStore = create(
  persist(
    (set) => ({
      manual: false, // ручное включение
      auto: false,   // авто на основе уровня батареи
      level: null,
      charging: null,
      setManual: (v) => set({ manual: !!v }),
      setAuto: (v) => set({ auto: v }),
      setBattery: (level, charging) => set({ level, charging }),
    }),
    {
      name: 'blink-battery',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ manual: s.manual }),
    }
  )
);

// Возвращает: shouldThrottle (true → реже обновляем геолокацию)
export const useBatterySaver = () => {
  const manual = useBatteryStore((s) => s.manual);
  const auto = useBatteryStore((s) => s.auto);
  const setBattery = useBatteryStore((s) => s.setBattery);
  const setAuto = useBatteryStore((s) => s.setAuto);

  useEffect(() => {
    if (!('getBattery' in navigator)) return;
    let battery;
    let cancelled = false;
    const update = () => {
      if (cancelled || !battery) return;
      setBattery(battery.level, battery.charging);
      const lowAndDischarging = battery.level <= 0.2 && !battery.charging;
      setAuto(lowAndDischarging);
    };
    navigator.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, [setBattery, setAuto]);

  return manual || auto;
};
