import express from 'express';
import Steps from '../models/Steps.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkBadges } from '../utils/badges.js';

const router = express.Router();

const todayStr = () => new Date().toISOString().split('T')[0];

// POST /api/steps — sync steps count for today (or a specific date)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { count, date } = req.body;
    if (typeof count !== 'number' || count < 0 || count > 200000) {
      return res.status(400).json({ error: 'Некорректное количество шагов' });
    }
    const day = date || todayStr();

    const doc = await Steps.findOneAndUpdate(
      { userId: req.user.id, date: day },
      { count, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Награждаем шагомер-badges (walker_10k / walker_50k)
    User.findById(req.user.id)
      .then((u) => u && checkBadges(u, req.app.get('io')))
      .catch(() => {});

    res.json({ count: doc.count, date: doc.date });
  } catch (error) {
    console.error('Ошибка сохранения шагов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/steps/leaderboard — today's steps for self + friends
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const day = todayStr();

    // Collect friend IDs
    const friendships = await Friendship.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted',
    });
    const friendIds = friendships.map((f) =>
      f.requester.toString() === req.user.id ? f.recipient.toString() : f.requester.toString()
    );
    const allIds = [req.user.id, ...friendIds];

    // Fetch steps and users in parallel
    const [stepDocs, users] = await Promise.all([
      Steps.find({ userId: { $in: allIds }, date: day }),
      User.find({ _id: { $in: allIds } }),
    ]);

    const stepsMap = new Map(stepDocs.map((s) => [s.userId.toString(), s.count]));

    const entries = users.map((u) => ({
      id: u._id,
      name: u.name,
      color: u.color,
      avatar: u.avatar || null,
      steps: stepsMap.get(u._id.toString()) || 0,
      isMe: u._id.toString() === req.user.id,
    }));

    entries.sort((a, b) => b.steps - a.steps);
    res.json(entries);
  } catch (error) {
    console.error('Ошибка лидерборда шагов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
