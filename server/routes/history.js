import express from 'express';
import LocationHistory from '../models/LocationHistory.js';
import Friendship from '../models/Friendship.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const isFriend = async (a, b) => {
  if (String(a) === String(b)) return true;
  const f = await Friendship.findOne({
    $or: [
      { requester: a, recipient: b },
      { requester: b, recipient: a },
    ],
    status: 'accepted',
  });
  return !!f;
};

// GET /api/history - моя история (по дате) или friend history
// ?userId=&from=ISO&to=ISO
router.get('/', authMiddleware, async (req, res) => {
  try {
    const targetId = req.query.userId || req.user.id;
    if (String(targetId) !== String(req.user.id)) {
      const allowed = await isFriend(req.user.id, targetId);
      if (!allowed) return res.status(403).json({ error: 'Нет доступа' });
    }
    const fromTs = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toTs = req.query.to ? new Date(req.query.to) : new Date();

    const points = await LocationHistory.find({
      userId: targetId,
      ts: { $gte: fromTs, $lte: toTs },
    }).sort({ ts: 1 });

    res.json(points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      speed: p.speed,
      ts: p.ts,
    })));
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/history/heatmap - агрегация для тепловой карты
// ?userId=&days=7
router.get('/heatmap', authMiddleware, async (req, res) => {
  try {
    const targetId = req.query.userId || req.user.id;
    if (String(targetId) !== String(req.user.id)) {
      const allowed = await isFriend(req.user.id, targetId);
      if (!allowed) return res.status(403).json({ error: 'Нет доступа' });
    }
    const days = Math.max(1, Math.min(30, Number(req.query.days) || 7));
    const fromTs = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const points = await LocationHistory.find({
      userId: targetId,
      ts: { $gte: fromTs },
    });

    // Кластеризуем по сетке ~50м (округление координат)
    const buckets = new Map();
    for (const p of points) {
      const key = `${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const heatmap = Array.from(buckets.entries()).map(([k, n]) => {
      const [lat, lng] = k.split('|').map(Number);
      return { lat, lng, intensity: Math.min(1, n / 20) };
    });
    res.json(heatmap);
  } catch (error) {
    console.error('Ошибка heatmap:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
