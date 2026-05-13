import express from 'express';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import Location from '../models/Location.js';
import Notification from '../models/Notification.js';
import { authMiddleware } from '../middleware/auth.js';
import { calculateDistance } from '../utils/haversine.js';
import { onlineUsers } from '../socket/onlineStore.js';
import { checkBadges } from '../utils/badges.js';

const router = express.Router();

// GET /api/friends - Получить список друзей с их локациями
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Находим все дружбы текущего пользователя
    const friendships = await Friendship.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted',
    }).populate('requester recipient');

    // Получаем ID друзей
    const friendIds = friendships.map((f) =>
      f.requester._id.toString() === req.user.id ? f.recipient._id : f.requester._id
    );

    // Получаем локации друзей
    const locations = await Location.find({ userId: { $in: friendIds } });

    // Получаем текущую локацию пользователя
    const myLocation = await Location.findOne({ userId: req.user.id });

    // Форматируем результат
    const friends = friendIds.map((friendId) => {
      const friendData = friendships.find(
        (f) =>
          (f.requester._id.toString() === friendId.toString() ||
            f.recipient._id.toString() === friendId.toString()) &&
          (f.requester._id.toString() === req.user.id || f.recipient._id.toString() === req.user.id)
      );

      const friend = friendData.requester._id.toString() === friendId.toString()
        ? friendData.requester
        : friendData.recipient;

      const location = locations.find((loc) => loc.userId.toString() === friendId.toString());

      let distance = null;
      if (location && myLocation) {
        distance = calculateDistance(myLocation.lat, myLocation.lng, location.lat, location.lng);
      }

      // Псевдоним, который мне сохранил для этого друга
      let nickname = '';
      const nickMap = friendData.nicknames;
      if (nickMap instanceof Map) {
        nickname = nickMap.get(String(req.user.id)) || '';
      } else if (nickMap && typeof nickMap === 'object') {
        nickname = nickMap[String(req.user.id)] || '';
      }

      const isOnline = onlineUsers.has(friendId.toString());
      return {
        id: friend._id,
        friendshipId: friendData._id,
        name: friend.name,
        nickname,
        email: friend.email,
        color: friend.color,
        avatar: friend.avatar,
        mood: friend.mood || '',
        moodEmoji: friend.moodEmoji || '',
        ghostMode: friend.ghostMode,
        online: isOnline,
        lastSeen: friend.lastSeen || null,
        location: location
          ? {
              lat: location.lat,
              lng: location.lng,
              address: location.address,
              speed: location.speed ?? null,
              heading: location.heading ?? null,
              updatedAt: location.updatedAt,
            }
          : null,
        distance,
      };
    });

    res.json(friends);
  } catch (error) {
    console.error('Ошибка получения друзей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/friends/requests - Получить входящие запросы
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await Friendship.find({
      recipient: req.user.id,
      status: 'pending',
    }).populate('requester', 'name email color');

    res.json(
      requests.map((r) => ({
        id: r._id,
        from: {
          id: r.requester._id,
          name: r.requester.name,
          email: r.requester.email,
          color: r.requester.color,
        },
      }))
    );
  } catch (error) {
    console.error('Ошибка получения запросов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/friends/invite - Добавить друга по коду приглашения
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Некорректный формат кода' });
    }

    const friend = await User.findOne({ inviteCode: code.toUpperCase() });
    if (!friend) {
      return res.status(404).json({ error: 'Код не найден' });
    }

    if (friend._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'Нельзя добавить себя' });
    }

    // Проверяем, нет ли уже дружбы
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: req.user.id, recipient: friend._id },
        { requester: friend._id, recipient: req.user.id },
      ],
    });

    if (existingFriendship) {
      return res.status(409).json({ error: 'Уже в друзьях или есть запрос' });
    }

    // Создаём дружбу со статусом 'pending' — ждёт подтверждения получателем
    const friendship = await Friendship.create({
      requester: req.user.id,
      recipient: friend._id,
      status: 'pending',
    });

    // Уведомление получателю о новом запросе
    await Notification.create({
      userId: friend._id,
      type: 'friend_request',
      fromUser: req.user.id,
    });

    const currentUser = await User.findById(req.user.id);

    // Real-time: получателю прилетает новый pending-запрос
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friend._id}`).emit('friend-request', {
        id: friendship._id,
        from: {
          id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          color: currentUser.color,
        },
      });
    }

    // Проверяем badges для обеих сторон
    Promise.all([
      checkBadges(currentUser, io),
      checkBadges(friend, io),
    ]).catch(() => {});

    res.status(201).json({
      message: `Запрос отправлен ${friend.name}`,
      friend: {
        id: friend._id,
        name: friend.name,
        email: friend.email,
        color: friend.color,
        inviteCode: friend.inviteCode,
      },
    });
  } catch (error) {
    console.error('Ошибка добавления друга:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/friends/:id/accept - Принять запрос дружбы
router.put('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);

    if (!friendship) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (friendship.recipient.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    friendship.status = 'accepted';
    await friendship.save();

    await Notification.create({
      userId: friendship.requester,
      type: 'request_accepted',
      fromUser: req.user.id,
    });

    const io = req.app.get('io');

    // Real-time: обе стороны перезагружают список друзей
    const [me, requester] = await Promise.all([
      User.findById(req.user.id),
      User.findById(friendship.requester),
    ]);
    if (io && me && requester) {
      io.to(`user:${friendship.requester}`).emit('friend-added', {
        from: { id: me._id, name: me.name, email: me.email, color: me.color },
      });
      io.to(`user:${req.user.id}`).emit('friend-added', {
        from: { id: requester._id, name: requester.name, email: requester.email, color: requester.color },
      });
    }

    // Badges для обеих сторон
    Promise.all([
      me && checkBadges(me, io),
      requester && checkBadges(requester, io),
    ]).catch(() => {});

    res.json({ message: 'Запрос принят' });
  } catch (error) {
    console.error('Ошибка принятия запроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/friends/:id/reject - Отклонить запрос дружбы
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const friendship = await Friendship.findById(req.params.id);

    if (!friendship) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (friendship.recipient.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const requesterId = friendship.requester.toString();
    await Friendship.findByIdAndDelete(req.params.id);

    // Real-time: уведомляем инициатора что запрос отклонён (для синхронизации UI)
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${requesterId}`).emit('friend-request-rejected', {
        byUserId: req.user.id,
      });
    }

    res.json({ message: 'Запрос отклонён' });
  } catch (error) {
    console.error('Ошибка отклонения запроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/friends/:friendId/nickname - сохранить личный псевдоним для друга
router.put('/:friendId/nickname', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    const friendship = await Friendship.findOne({
      $or: [
        { requester: req.user.id, recipient: req.params.friendId },
        { requester: req.params.friendId, recipient: req.user.id },
      ],
      status: 'accepted',
    });
    if (!friendship) return res.status(404).json({ error: 'Дружба не найдена' });

    if (!(friendship.nicknames instanceof Map)) friendship.nicknames = new Map();
    const clean = (nickname || '').trim().slice(0, 40);
    if (clean) {
      friendship.nicknames.set(String(req.user.id), clean);
    } else {
      friendship.nicknames.delete(String(req.user.id));
    }
    await friendship.save();
    res.json({ ok: true, nickname: clean });
  } catch (error) {
    console.error('Ошибка сохранения псевдонима:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/friends/:id - Удалить друга
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const friendship = await Friendship.findOne({
      $or: [
        { requester: req.user.id, recipient: req.params.id },
        { requester: req.params.id, recipient: req.user.id },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Дружба не найдена' });
    }

    await Friendship.findByIdAndDelete(friendship._id);

    // Реальное время: уведомляем вторую сторону
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.params.id}`).emit('friend-removed', { userId: req.user.id });
    }

    res.json({ message: 'Друг удалён' });
  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
