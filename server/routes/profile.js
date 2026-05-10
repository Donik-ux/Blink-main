import express from 'express';
import bcryptjs from 'bcryptjs';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';
import Notification from '../models/Notification.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Location from '../models/Location.js';
import LocationHistory from '../models/LocationHistory.js';
import CheckIn from '../models/CheckIn.js';
import Story from '../models/Story.js';
import Geofence from '../models/Geofence.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const VALID_COLORS = [
  '#7c3aed', '#db2777', '#d97706', '#059669', '#2563eb',
  '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#ea580c',
];

const profileShape = (user, friendsCount) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  color: user.color,
  avatar: user.avatar,
  inviteCode: user.inviteCode,
  ghostMode: user.ghostMode,
  privacyMode: user.privacyMode,
  mood: user.mood || '',
  moodEmoji: user.moodEmoji || '',
  locale: user.locale || 'ru',
  theme: user.theme || 'dark',
  points: user.points || 0,
  badges: user.badges || [],
  totalDistance: user.totalDistance || 0,
  friendsCount,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt,
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const friendsCount = await Friendship.countDocuments({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted',
    });
    res.json(profileShape(user, friendsCount));
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const {
      name, color, ghostMode, privacyMode, avatar,
      mood, moodEmoji, locale, theme,
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (name !== undefined) {
      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
      }
      user.name = name;
    }

    if (color !== undefined) {
      if (!VALID_COLORS.includes(color)) {
        return res.status(400).json({ error: 'Некорректный цвет' });
      }
      user.color = color;
    }

    if (ghostMode !== undefined) user.ghostMode = Boolean(ghostMode);

    if (privacyMode !== undefined) {
      if (!['friends', 'everyone'].includes(privacyMode)) {
        return res.status(400).json({ error: 'Некорректный режим приватности' });
      }
      user.privacyMode = privacyMode;
    }

    if (avatar !== undefined) {
      if (avatar === null || avatar === '') {
        user.avatar = null;
      } else {
        if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
          return res.status(400).json({ error: 'Некорректный формат аватара' });
        }
        if (avatar.length > 95_000) {
          return res.status(400).json({ error: 'Аватар слишком большой (макс ~70KB)' });
        }
        user.avatar = avatar;
      }
    }

    if (mood !== undefined) {
      user.mood = String(mood).slice(0, 80);
    }
    if (moodEmoji !== undefined) {
      user.moodEmoji = String(moodEmoji).slice(0, 8);
    }
    if (locale !== undefined) {
      if (!['ru', 'uz', 'en'].includes(locale)) {
        return res.status(400).json({ error: 'Некорректный язык' });
      }
      user.locale = locale;
    }
    if (theme !== undefined) {
      if (!['dark', 'light'].includes(theme)) {
        return res.status(400).json({ error: 'Некорректная тема' });
      }
      user.theme = theme;
    }

    await user.save();

    const friendsCount = await Friendship.countDocuments({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted',
    });

    res.json({
      message: 'Профиль обновлён',
      user: profileShape(user, friendsCount),
    });
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/profile/privacy-zone — установить или убрать приватную зону
router.put('/privacy-zone', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, radius, active } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (active === false) {
      user.privacyZone = null;
    } else {
      if (typeof lat !== 'number' || typeof lng !== 'number' ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Некорректные координаты' });
      }
      const r = Math.max(50, Math.min(1000, Number(radius) || 200));
      user.privacyZone = { lat, lng, radius: r, active: true };
    }
    await user.save();
    res.json({ ok: true, privacyZone: user.privacyZone });
  } catch (error) {
    console.error('Ошибка privacy-zone:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/profile/live-share — поделиться локацией друзьям до timestamp
router.put('/live-share', authMiddleware, async (req, res) => {
  try {
    const { minutes } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (!minutes || minutes <= 0) {
      user.liveShareUntil = null;
    } else {
      const m = Math.min(720, Math.max(1, Number(minutes))); // макс 12ч
      user.liveShareUntil = new Date(Date.now() + m * 60_000);
    }
    await user.save();
    res.json({ ok: true, liveShareUntil: user.liveShareUntil });
  } catch (error) {
    console.error('Ошибка live-share:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/profile/blocked — список заблокированных
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const blockedIds = user.blocked || [];
    if (blockedIds.length === 0) return res.json([]);
    const users = await User.find({ _id: { $in: blockedIds } });
    res.json(
      users.map((u) => ({
        id: u._id, name: u.name, email: u.email, color: u.color, avatar: u.avatar,
      }))
    );
  } catch (error) {
    console.error('Ошибка получения blocked:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/profile/block/:userId — заблокировать пользователя
router.post('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (String(targetId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    }
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    const user = await User.findById(req.user.id);
    if (!user.blocked.some((id) => String(id) === String(targetId))) {
      user.blocked.push(targetId);
      await user.save();
    }

    // Удаляем дружбу если была
    await Friendship.findOneAndDelete({
      $or: [
        { requester: req.user.id, recipient: targetId },
        { requester: targetId, recipient: req.user.id },
      ],
    });

    const io = req.app.get('io');
    if (io) io.to(`user:${targetId}`).emit('friend-removed', { userId: req.user.id });

    res.json({ ok: true });
  } catch (error) {
    console.error('Ошибка block:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/profile/block/:userId — разблокировать
router.delete('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.blocked = (user.blocked || []).filter((id) => String(id) !== String(req.params.userId));
    await user.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Ошибка unblock:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/profile/report/:userId — пожаловаться на пользователя
router.post('/report/:userId', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.userId;
    const { reason } = req.body || {};
    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({ error: 'Опишите причину (мин. 3 символа)' });
    }
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    target.reportsReceived = target.reportsReceived || [];
    target.reportsReceived.push({
      fromUser: req.user.id,
      reason: String(reason).slice(0, 500),
      createdAt: new Date(),
    });
    await target.save();
    res.json({ ok: true, message: 'Спасибо, мы рассмотрим жалобу' });
  } catch (error) {
    console.error('Ошибка report:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/profile — удалить аккаунт (cascade)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Если у юзера есть пароль — требуем подтверждение паролем (защита от случайного клика).
    // Google-only аккаунтам пропускаем (пароля у них нет).
    if (user.passwordHash) {
      if (!password) return res.status(400).json({ error: 'Подтвердите паролем' });
      const ok = await bcryptjs.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Неверный пароль' });
    }

    const uid = req.user.id;
    // Cascade — удаляем все связанные данные
    await Promise.all([
      Friendship.deleteMany({ $or: [{ requester: uid }, { recipient: uid }] }),
      Notification.deleteMany({ $or: [{ userId: uid }, { fromUser: uid }] }),
      Message.deleteMany({ $or: [{ sender: uid }, { recipient: uid }] }),
      Conversation.deleteMany({ participants: uid }),
      Location.deleteMany({ userId: uid }),
      LocationHistory.deleteMany({ userId: uid }),
      CheckIn.deleteMany({ userId: uid }),
      Story.deleteMany({ userId: uid }),
      Geofence.deleteMany({ userId: uid }),
    ]);

    // Уведомить друзей и убрать из blocked-списков других
    const io = req.app.get('io');
    if (io) io.emit('user-deleted', { userId: uid });

    await User.findByIdAndDelete(uid);
    res.json({ message: 'Аккаунт удалён' });
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
