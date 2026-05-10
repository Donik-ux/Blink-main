import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { BADGES, checkBadges } from '../utils/badges.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const owned = new Set(user?.badges || []);
    const all = Object.entries(BADGES).map(([id, def]) => ({
      id,
      ...def,
      earned: owned.has(id),
    }));
    res.json({ badges: all, points: user?.points || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/badges/check - принудительная проверка (например после действия)
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const earned = await checkBadges(user, req.app.get('io'));
    res.json({ newBadges: earned });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
