import express from 'express';
import Geofence from '../models/Geofence.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const fences = await Geofence.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(fences);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, emoji, lat, lng, radius, trigger, notifyForFriends } = req.body;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Нужно name, lat, lng' });
    }
    const r = Math.max(50, Math.min(2000, Number(radius) || 150));
    const fence = await Geofence.create({
      userId: req.user.id,
      name: String(name).slice(0, 50),
      emoji: emoji || '🏠',
      lat,
      lng,
      radius: r,
      trigger: ['enter', 'exit', 'both'].includes(trigger) ? trigger : 'both',
      notifyForFriends: notifyForFriends !== false,
    });
    res.status(201).json(fence);
  } catch (error) {
    console.error('Ошибка создания геозоны:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const fence = await Geofence.findById(req.params.id);
    if (!fence || String(fence.userId) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    const { name, emoji, lat, lng, radius, trigger, notifyForFriends, active } = req.body;
    if (name !== undefined) fence.name = String(name).slice(0, 50);
    if (emoji !== undefined) fence.emoji = emoji;
    if (typeof lat === 'number') fence.lat = lat;
    if (typeof lng === 'number') fence.lng = lng;
    if (radius !== undefined) fence.radius = Math.max(50, Math.min(2000, Number(radius)));
    if (trigger !== undefined && ['enter', 'exit', 'both'].includes(trigger)) fence.trigger = trigger;
    if (notifyForFriends !== undefined) fence.notifyForFriends = Boolean(notifyForFriends);
    if (active !== undefined) fence.active = Boolean(active);
    await fence.save();
    res.json(fence);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const fence = await Geofence.findById(req.params.id);
    if (!fence || String(fence.userId) !== String(req.user.id)) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    await Geofence.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
