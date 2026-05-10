import { useState, useEffect, useCallback } from 'react';
import { getPushKey, subscribePush, unsubscribePush } from '../api/push.js';

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const data = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(data);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const usePushNotifications = () => {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {}
    })();
  }, []);

  const enable = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await getPushKey();
      if (!publicKey) {
        console.warn('VAPID public key пустой — серверная подписка отключена');
        return false;
      }
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await subscribePush(existing.toJSON());
        setSubscribed(true);
        return true;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await subscribePush(sub.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      console.warn('Push subscribe failed:', err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.warn('Push unsubscribe failed:', err.message);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, subscribed, busy, enable, disable };
};
