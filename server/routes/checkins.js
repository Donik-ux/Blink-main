import express from 'express';
import CheckIn from '../models/CheckIn.js';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';
import { authMiddleware } from '../middleware/auth.js';
import { calculateDistance } from '../utils/haversine.js';
import { checkBadges } from '../utils/badges.js';

const router = express.Router();

// POST /api/checkins - check-in в место
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { placeId, placeName, emoji, lat, lng, note } = req.body;
    if (!placeName || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Нужно placeName, lat, lng' });
    }

    // Анти-спам: не более одного чек-ина в это же место за 1 час
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await CheckIn.find({
      userId: req.user.id,
      createdAt: { $gte: oneHourAgo },
    });
    const dup = recent.find((c) => {
      const d = calculateDistance(c.lat, c.lng, lat, lng);
      return d.unit === 'м' && d.value < 50;
    });
    if (dup) {
      return res.status(429).json({ error: 'Уже отметился здесь недавно' });
    }

    const checkin = await CheckIn.create({
      userId: req.user.id,
      placeId: placeId || null,
      placeName: String(placeName).slice(0, 60),
      emoji: emoji || '📍',
      lat,
      lng,
      note: String(note || '').slice(0, 200),
      points: 10,
    });

    const user = await User.findById(req.user.id);
    user.points = (user.points || 0) + 10;
    await user.save();
    const newBadges = await checkBadges(user, req.app.get('io'));

    // Уведомить друзей
    const io = req.app.get('io');
    if (io) {
      const list = await Friendship.find({
        $or: [{ requester: req.user.id }, { recipient: req.user.id }],
        status: 'accepted',
      });
      const friendIds = list.map((f) =>
        String(f.requester) === String(req.user.id) ? String(f.recipient) : String(f.requester)
      );
      for (const fid of friendIds) {
        io.to(`user:${fid}`).emit('friend-checkin', {
          userId: req.user.id,
          name: user.name,
          placeName: checkin.placeName,
          emoji: checkin.emoji,
          lat,
          lng,
        });
      }
    }

    res.status(201).json({ checkin, points: user.points, newBadges });
  } catch (error) {
    console.error('Ошибка check-in:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/checkins/:id - удалить свой чек-ин
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const checkin = await CheckIn.findById(req.params.id);
    if (!checkin) return res.status(404).json({ error: 'Чек-ин не найден' });
    if (String(checkin.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Можно удалить только свой чек-ин' });
    }
    await CheckIn.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Ошибка удаления чек-ина:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/checkins - мои + друзей за последние 30д
router.get('/', authMiddleware, async (req, res) => {
  try {
    const list = await Friendship.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted',
    });
    const ids = [
      req.user.id,
      ...list.map((f) =>
        String(f.requester) === String(req.user.id) ? String(f.recipient) : String(f.requester)
      ),
    ];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const items = await CheckIn.find({
      userId: { $in: ids },
      createdAt: { $gte: monthAgo },
    })
      .populate('userId', 'name color avatar')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
