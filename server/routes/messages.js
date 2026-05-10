import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Friendship from '../models/Friendship.js';
import { authMiddleware as authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];
const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 минут

// Хелпер: проверить что юзер участник разговора
const isParticipant = (conv, userId) => {
  if (!conv) return false;
  return (conv.participants || []).some((p) => String(p?._id || p) === String(userId));
};

// GET все разговоры юзера
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
    })
      .populate('participants', 'name email color avatar mood moodEmoji')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET сообщения из разговора
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!isParticipant(conv, req.user.id)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    })
      .populate('senderId', 'name color avatar')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST создать/получить разговор с другом (1-to-1)
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Требуется ID друга' });
    }

    let conversation = await Conversation.findOne({
      kind: 'direct',
      participants: { $all: [req.user.id, friendId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        kind: 'direct',
        participants: [req.user.id, friendId],
        unreadCount: {
          [req.user.id]: 0,
          [friendId]: 0,
        },
      });
    }

    await conversation.populate('participants', 'name email color avatar mood moodEmoji');

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST создать групповой чат
router.post('/groups', authenticateToken, async (req, res) => {
  try {
    const { title, memberIds, avatar } = req.body;
    const me = req.user.id;
    const cleanTitle = (title || '').trim();
    if (!cleanTitle || cleanTitle.length > 60) {
      return res.status(400).json({ error: 'Название группы 1–60 символов' });
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Нужен хотя бы один участник' });
    }

    // Только друзей разрешаем добавлять
    const friendships = await Friendship.find({
      $or: [{ requester: me }, { recipient: me }],
      status: 'accepted',
    });
    const friendSet = new Set(
      friendships.map((f) =>
        String(f.requester) === String(me) ? String(f.recipient) : String(f.requester)
      )
    );

    const validMembers = memberIds.filter((id) => friendSet.has(String(id)));
    const participants = [me, ...validMembers];
    const unread = {};
    participants.forEach((id) => { unread[id] = 0; });

    const conversation = await Conversation.create({
      kind: 'group',
      title: cleanTitle,
      avatar: avatar || null,
      ownerId: me,
      participants,
      unreadCount: unread,
    });

    await conversation.populate('participants', 'name email color avatar mood moodEmoji');

    // Notify members via socket
    const io = req.app.get('io');
    if (io) {
      for (const id of participants) {
        if (String(id) === String(me)) continue;
        io.to(`user:${id}`).emit('group-created', { conversation });
      }
    }

    res.json(conversation);
  } catch (error) {
    console.error('Ошибка создания группы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST отправить сообщение
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, text, kind = 'text', audio, audioDuration, image, replyTo } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'Требуется conversationId' });
    }
    if (kind === 'text' && !(text || '').trim()) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }
    if (kind === 'voice' && !audio) {
      return res.status(400).json({ error: 'Нет аудио' });
    }
    if (kind === 'image') {
      if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Некорректное изображение' });
      }
      if (image.length > 200_000) {
        return res.status(400).json({ error: 'Изображение слишком большое' });
      }
    }

    const conv = await Conversation.findById(conversationId);
    if (!isParticipant(conv, req.user.id)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    // Создаём сообщение
    const message = await Message.create({
      conversationId,
      senderId: req.user.id,
      text: kind === 'text' ? (text || '').trim() : (text || '').slice(0, 200),
      kind,
      audio: kind === 'voice' ? audio : null,
      audioDuration: kind === 'voice' ? Number(audioDuration) || 0 : 0,
      image: kind === 'image' ? image : null,
      replyTo: replyTo || null,
    });

    // Обновляем разговор
    const preview = kind === 'voice' ? '🎤 Голосовое' : kind === 'image' ? '📷 Фото' : (text || '').slice(0, 100);
    conv.lastMessage = preview;
    conv.lastMessageTime = new Date();
    conv.lastMessageSenderId = req.user.id;

    if (conv.unreadCount instanceof Map) {
      for (const participantId of conv.participants) {
        const pid = String(participantId?._id || participantId);
        if (pid !== String(req.user.id)) {
          const cur = conv.unreadCount.get(pid) || 0;
          conv.unreadCount.set(pid, cur + 1);
        }
      }
    }
    await conv.save();

    const msg = await message.populate('senderId', 'name color avatar');

    // Broadcast group messages via socket к остальным участникам
    if (conv.kind === 'group') {
      const io = req.app.get('io');
      if (io) {
        for (const pid of conv.participants) {
          const id = String(pid?._id || pid);
          if (id === String(req.user.id)) continue;
          io.to(`user:${id}`).emit('receive-message', {
            conversationId,
            messageId: msg._id,
            senderId: req.user.id,
            senderName: msg.senderId?.name,
            senderColor: msg.senderId?.color,
            text: msg.text,
            kind: msg.kind,
            audio: msg.audio,
            audioDuration: msg.audioDuration,
            image: msg.image,
            replyTo: msg.replyTo,
            timestamp: msg.createdAt,
          });
        }
      }
    }

    res.status(201).json(msg);
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT редактировать сообщение
router.put('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!(text || '').trim()) {
      return res.status(400).json({ error: 'Пустой текст' });
    }
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Не найдено' });
    if (String(msg.senderId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Не своё сообщение' });
    }
    if (msg.kind !== 'text') {
      return res.status(400).json({ error: 'Только текст можно редактировать' });
    }
    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    if (ageMs > EDIT_WINDOW_MS) {
      return res.status(400).json({ error: 'Окно редактирования истекло' });
    }
    msg.text = text.trim();
    msg.editedAt = new Date();
    await msg.save();

    const conv = await Conversation.findById(msg.conversationId);
    const io = req.app.get('io');
    if (io && conv) {
      for (const pid of conv.participants) {
        io.to(`user:${String(pid)}`).emit('message-edited', {
          conversationId: msg.conversationId,
          messageId: msg._id,
          text: msg.text,
          editedAt: msg.editedAt,
        });
      }
    }
    res.json(msg);
  } catch (error) {
    console.error('Ошибка редактирования:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE сообщение (мягкое удаление)
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Не найдено' });
    if (String(msg.senderId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Не своё сообщение' });
    }
    msg.deleted = true;
    msg.text = '';
    msg.audio = null;
    await msg.save();

    const conv = await Conversation.findById(msg.conversationId);
    const io = req.app.get('io');
    if (io && conv) {
      for (const pid of conv.participants) {
        io.to(`user:${String(pid)}`).emit('message-deleted', {
          conversationId: msg.conversationId,
          messageId: msg._id,
        });
      }
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST реакция на сообщение (toggle)
router.post('/messages/:id/reaction', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ error: 'Реакция не разрешена' });
    }
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Не найдено' });

    const conv = await Conversation.findById(msg.conversationId);
    if (!isParticipant(conv, req.user.id)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const map = msg.reactions instanceof Map ? msg.reactions : new Map();
    const existing = map.get(String(req.user.id));
    if (existing === emoji) {
      map.delete(String(req.user.id));
    } else {
      map.set(String(req.user.id), emoji);
    }
    msg.reactions = map;
    await msg.save();

    const reactionsObj = Object.fromEntries(map);
    const io = req.app.get('io');
    if (io && conv) {
      for (const pid of conv.participants) {
        io.to(`user:${String(pid)}`).emit('message-reaction', {
          conversationId: msg.conversationId,
          messageId: msg._id,
          reactions: reactionsObj,
        });
      }
    }
    res.json({ reactions: reactionsObj });
  } catch (error) {
    console.error('Ошибка реакции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT отметить сообщения как прочитанные
router.put('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!isParticipant(conv, req.user.id)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    const now = new Date().toISOString();

    // Помечаем все сообщения как прочитанные мной (кроме своих)
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    });
    for (const m of messages) {
      if (String(m.senderId) === String(req.user.id)) continue;
      if (!(m.seenBy instanceof Map)) m.seenBy = new Map();
      if (!m.seenBy.has(String(req.user.id))) {
        m.seenBy.set(String(req.user.id), now);
      }
      m.isRead = true;
      await m.save();
    }

    if (conv.unreadCount instanceof Map) {
      conv.unreadCount.set(String(req.user.id), 0);
      await conv.save();
    }

    // Уведомить других участников об изменении seen-статусов
    const io = req.app.get('io');
    if (io && conv) {
      for (const pid of conv.participants) {
        const id = String(pid?._id || pid);
        if (id === String(req.user.id)) continue;
        io.to(`user:${id}`).emit('messages-seen', {
          conversationId: req.params.conversationId,
          seenBy: req.user.id,
          seenAt: now,
        });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
