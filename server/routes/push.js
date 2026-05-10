import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { getPublicKey, sendPushToUser } from '../utils/push.js';

const router = express.Router();

// GET /api/push/key - публичный VAPID
router.get('/key', (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

// POST /api/push/subscribe
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const sub = req.body?.subscription;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: 'Нужна подписка' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const subs = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions : [];
    if (!subs.find((s) => s.endpoint === sub.endpoint)) {
      subs.push(sub);
    }
    user.pushSubscriptions = subs;
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Ошибка подписки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    user.pushSubscriptions = (user.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint);
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/push/test
router.post('/test', authMiddleware, async (req, res) => {
  try {
    await sendPushToUser(User, req.user.id, {
      title: 'Blink',
      body: 'Тестовое уведомление работает 🎉',
      tag: 'test',
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
