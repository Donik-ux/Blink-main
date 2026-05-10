import express from 'express';
import Story from '../models/Story.js';
import Friendship from '../models/Friendship.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const getFriendIds = async (userId) => {
  const list = await Friendship.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  });
  return list.map((f) => (String(f.requester) === String(userId) ? String(f.recipient) : String(f.requester)));
};

// GET /api/stories - feed: stories друзей + мои за последние 24ч
router.get('/', authMiddleware, async (req, res) => {
  try {
    const friendIds = await getFriendIds(req.user.id);
    const userIds = [req.user.id, ...friendIds];
    const now = new Date();
    const stories = await Story.find({
      userId: { $in: userIds },
      expiresAt: { $gt: now },
    })
      .populate('userId', 'name color avatar mood moodEmoji')
      .sort({ createdAt: -1 });

    // Группируем по пользователю
    const byUser = new Map();
    for (const s of stories) {
      const uid = String(s.userId?._id || s.userId);
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          userId: uid,
          name: s.userId?.name,
          color: s.userId?.color,
          avatar: s.userId?.avatar,
          mood: s.userId?.mood,
          moodEmoji: s.userId?.moodEmoji,
          stories: [],
          hasUnseen: false,
        });
      }
      const item = byUser.get(uid);
      const seen = (s.viewers || []).map(String).includes(String(req.user.id));
      if (!seen && uid !== String(req.user.id)) item.hasUnseen = true;
      item.stories.push({
        _id: s._id,
        kind: s.kind,
        text: s.text,
        image: s.image,
        bgColor: s.bgColor,
        lat: s.lat,
        lng: s.lng,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewers: s.viewers || [],
        seen,
      });
    }
    const feed = Array.from(byUser.values()).sort((a, b) => {
      // Свои в начало, потом неувиденные
      if (a.userId === req.user.id) return -1;
      if (b.userId === req.user.id) return 1;
      return (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0);
    });
    res.json(feed);
  } catch (error) {
    console.error('Ошибка получения историй:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/stories - создать историю
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { kind = 'text', text = '', image, bgColor, lat, lng } = req.body;
    if (kind === 'text' && !text.trim()) {
      return res.status(400).json({ error: 'Пустой текст' });
    }
    if (kind === 'image' && !image) {
      return res.status(400).json({ error: 'Нет картинки' });
    }
    if (image && image.length > 200_000) {
      return res.status(400).json({ error: 'Картинка слишком большая' });
    }

    const story = await Story.create({
      userId: req.user.id,
      kind,
      text: String(text).slice(0, 240),
      image: image || null,
      bgColor: bgColor || '#7c3aed',
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    });

    // Уведомить друзей
    const io = req.app.get('io');
    if (io) {
      const friendIds = await getFriendIds(req.user.id);
      for (const fid of friendIds) {
        io.to(`user:${fid}`).emit('story-posted', { userId: req.user.id });
      }
    }
    res.status(201).json(story);
  } catch (error) {
    console.error('Ошибка создания истории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/stories/:id/view - отметить как просмотренную
router.post('/:id/view', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Не найдено' });
    const viewers = (story.viewers || []).map(String);
    if (!viewers.includes(String(req.user.id)) && String(story.userId) !== String(req.user.id)) {
      story.viewers = [...viewers, req.user.id];
      await story.save();
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/stories/:id - удалить свою историю
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Не найдено' });
    if (String(story.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Не своё' });
    }
    await Story.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
