import jwt from 'jsonwebtoken';
import Location from '../models/Location.js';
import LocationHistory from '../models/LocationHistory.js';
import User from '../models/User.js';
import Friendship from '../models/Friendship.js';
import Notification from '../models/Notification.js';
import Geofence from '../models/Geofence.js';
import { calculateDistance } from '../utils/haversine.js';
import { geocodeAddress } from '../utils/geocode.js';
import { onlineUsers } from './onlineStore.js';
import { sendPushToUser } from '../utils/push.js';

// Кеши
const lastGeocode = new Map();
const lastBroadcast = new Map();
const lastKnownLocation = new Map();
const lastHistoryLog = new Map(); // userId -> timestamp последней записи в историю
// Состояние geofence: userId -> Set<fenceId> внутри которых юзер сейчас
const insideFences = new Map();

const LOCATION_THROTTLE_MS = 3000;
const GEOCODE_MOVE_THRESHOLD_M = 80;
const HISTORY_LOG_INTERVAL_MS = 30_000; // запись каждые 30с
const HISTORY_LOG_MIN_MOVE_M = 25;

const getFriendIds = async (userId) => {
  const friendships = await Friendship.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  });
  return friendships.map((f) =>
    f.requester.toString() === userId ? f.recipient.toString() : f.requester.toString()
  );
};

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const d = calculateDistance(lat1, lng1, lat2, lng2);
  return d.unit === 'км' ? parseFloat(d.value) * 1000 : d.value;
};

export const setupSocketHandlers = (io) => {
  // Аутентификация на уровне коннекта: токен из handshake.auth обязателен.
  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) return next(new Error('Токен отсутствует'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.typ && decoded.typ !== 'access') {
        return next(new Error('Неверный тип токена'));
      }
      socket.userId = String(decoded.id);
      return next();
    } catch (e) {
      return next(new Error('Некорректный токен'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join', async (data) => {
      try {
        // userId уже установлен в io.use(); поддерживаем legacy data.token для обратной совместимости.
        if (!socket.userId && data?.token) {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            socket.userId = String(decoded.id);
          } catch {
            socket.emit('error', { message: 'Некорректный токен' });
            return;
          }
        }
        if (!socket.userId) {
          socket.emit('error', { message: 'Не аутентифицирован' });
          return;
        }

        const userId = socket.userId;
        socket.join(`user:${userId}`);
        onlineUsers.set(userId, socket.id);

        const user = await User.findById(userId);
        if (!user) {
          socket.emit('error', { message: 'Пользователь не найден' });
          return;
        }

        const friendIds = await getFriendIds(userId);
        const onlineFriendIds = friendIds.filter((id) => onlineUsers.has(id));

        if (onlineFriendIds.length > 0) {
          for (const friendId of onlineFriendIds) {
            io.to(`user:${friendId}`).emit('friend-online', {
              userId,
              name: user.name,
            });
          }
          await Promise.all(
            onlineFriendIds.map((friendId) =>
              Notification.create({ userId: friendId, type: 'online', fromUser: userId })
            )
          );
        }

        socket.emit('joined', { message: 'Подключены' });
      } catch (error) {
        console.error('Ошибка JOIN:', error);
        socket.emit('error', { message: 'Ошибка подключения' });
      }
    });

    socket.on('update-location', async (data) => {
      try {
        const userId = socket.userId;
        if (!userId) {
          socket.emit('error', { message: 'Не аутентифицирован' });
          return;
        }

        const { lat, lng, accuracy, speed: clientSpeed, heading, batterySaver } = data || {};

        if (
          typeof lat !== 'number' || typeof lng !== 'number' ||
          !Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180
        ) return;

        const now = Date.now();
        const throttle = batterySaver ? 30_000 : LOCATION_THROTTLE_MS;
        const lastT = lastBroadcast.get(userId) || 0;
        if (now - lastT < throttle) return;
        lastBroadcast.set(userId, now);

        let speed = (typeof clientSpeed === 'number' && clientSpeed >= 0) ? clientSpeed : null;
        const prevLoc = lastKnownLocation.get(userId);
        if (speed === null && prevLoc) {
          const timeDelta = (now - prevLoc.timestamp) / 1000;
          if (timeDelta > 0 && timeDelta < 60) {
            speed = distanceMeters(prevLoc.lat, prevLoc.lng, lat, lng) / timeDelta;
          }
        }
        lastKnownLocation.set(userId, { lat, lng, timestamp: now });

        const prev = lastGeocode.get(userId);
        let address;
        if (prev) {
          if (distanceMeters(prev.lat, prev.lng, lat, lng) < GEOCODE_MOVE_THRESHOLD_M) {
            address = prev.address;
          }
        }
        if (!address) {
          address = await geocodeAddress(lat, lng);
          lastGeocode.set(userId, { lat, lng, address });
        }

        await Location.findOneAndUpdate(
          { userId },
          { lat, lng, accuracy, address, speed, heading: heading ?? null, updatedAt: new Date() },
          { upsert: true, new: true }
        );

        // Запись в историю (с интервалом + минимальным сдвигом)
        const lastHist = lastHistoryLog.get(userId) || 0;
        if (now - lastHist >= HISTORY_LOG_INTERVAL_MS) {
          const lastHistPoint = prevLoc;
          if (!lastHistPoint || distanceMeters(lastHistPoint.lat, lastHistPoint.lng, lat, lng) >= HISTORY_LOG_MIN_MOVE_M) {
            lastHistoryLog.set(userId, now);
            try {
              await LocationHistory.create({ userId, lat, lng, accuracy: accuracy || 0, speed: speed || 0, ts: new Date() });
            } catch {}
          }
        }

        const sender = await User.findById(userId);
        if (!sender) return;

        if (typeof data.ghostMode === 'boolean') {
          sender.ghostMode = data.ghostMode;
          await sender.save();
        }
        const isGhost = sender.ghostMode;

        // Geofence trigger (мои зоны: уведомить меня когда я входжу/выхожу)
        try {
          const myFences = await Geofence.find({ userId, active: true });
          const inside = insideFences.get(userId) || new Set();
          const newInside = new Set();
          for (const fence of myFences) {
            const d = distanceMeters(lat, lng, fence.lat, fence.lng);
            const isInside = d <= fence.radius;
            const wasInside = inside.has(String(fence._id));
            if (isInside) newInside.add(String(fence._id));

            if (isInside && !wasInside && (fence.trigger === 'enter' || fence.trigger === 'both')) {
              io.to(`user:${userId}`).emit('geofence-trigger', {
                fenceId: fence._id,
                name: fence.name,
                emoji: fence.emoji,
                event: 'enter',
              });
              await sendPushToUser(User, userId, {
                title: `${fence.emoji} ${fence.name}`,
                body: 'Ты вошёл в зону',
                tag: `fence-${fence._id}`,
              });
            }
            if (!isInside && wasInside && (fence.trigger === 'exit' || fence.trigger === 'both')) {
              io.to(`user:${userId}`).emit('geofence-trigger', {
                fenceId: fence._id,
                name: fence.name,
                emoji: fence.emoji,
                event: 'exit',
              });
              await sendPushToUser(User, userId, {
                title: `${fence.emoji} ${fence.name}`,
                body: 'Ты покинул зону',
                tag: `fence-${fence._id}`,
              });
            }
          }
          insideFences.set(userId, newInside);
        } catch (e) {
          console.warn('Geofence err:', e.message);
        }

        const friendIds = await getFriendIds(userId);
        if (friendIds.length === 0) return;

        // В режиме призрака — не транслируем координаты, только статус.
        if (isGhost) {
          for (const friendId of friendIds) {
            io.to(`user:${friendId}`).emit('friend-location-update', {
              userId, ghostMode: true, updatedAt: new Date(),
            });
          }
          return;
        }

        const friendLocations = await Location.find({ userId: { $in: friendIds } });
        const locByFriend = new Map(
          friendLocations.map((l) => [l.userId.toString(), l])
        );

        const nearbyToNotify = [];
        for (const friendId of friendIds) {
          const friendLoc = locByFriend.get(friendId);
          let distance = null;
          if (friendLoc) {
            distance = calculateDistance(lat, lng, friendLoc.lat, friendLoc.lng);
          }

          io.to(`user:${friendId}`).emit('friend-location-update', {
            userId, lat, lng, accuracy, address,
            ghostMode: false, distance, speed, heading: heading ?? null,
            updatedAt: new Date(),
          });

          if (distance && distance.unit === 'м' && distance.value <= 10) {
            nearbyToNotify.push({ friendId, meters: distance.value });
          }
        }

        if (nearbyToNotify.length > 0) {
          const antispamFrom = new Date(now - 10 * 60_000);
          await Promise.all(
            nearbyToNotify.map(async ({ friendId, meters }) => {
              const existing = await Notification.findOne({
                userId: friendId,
                type: 'nearby',
                fromUser: userId,
                createdAt: { $gte: antispamFrom },
              });
              if (!existing) {
                await Notification.create({ userId: friendId, type: 'nearby', fromUser: userId });
                io.to(`user:${friendId}`).emit('friend-nearby', {
                  userId,
                  name: sender.name,
                  meters: Math.round(meters),
                });
                sendPushToUser(User, friendId, {
                  title: 'Друг рядом!',
                  body: `${sender.name} в ${Math.round(meters)} м от тебя`,
                  tag: `nearby-${userId}`,
                }).catch(() => {});
              }
            })
          );
        }
      } catch (error) {
        console.error('Ошибка UPDATE-LOCATION:', error);
      }
    });

    socket.on('disconnect', async () => {
      try {
        const userId = socket.userId;
        if (!userId) return;
        onlineUsers.delete(userId);
        lastBroadcast.delete(userId);
        lastGeocode.delete(userId);
        lastKnownLocation.delete(userId);
        lastHistoryLog.delete(userId);
        insideFences.delete(userId);

        const lastSeenAt = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen: lastSeenAt });

        const friendIds = await getFriendIds(userId);
        const onlineFriends = friendIds.filter((id) => onlineUsers.has(id));
        if (onlineFriends.length === 0) return;

        const user = await User.findById(userId);
        const name = user?.name || '';
        for (const friendId of onlineFriends) {
          io.to(`user:${friendId}`).emit('friend-offline', { userId, name, lastSeen: lastSeenAt });
        }
      } catch (error) {
        console.error('Ошибка DISCONNECT:', error);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket ошибка:', error);
    });

    // CHAT (1-to-1 быстрый канал)
    socket.on('chat-message', async (data) => {
      try {
        const userId = socket.userId;
        const { conversationId, message, recipientId, sticker, kind, audio, audioDuration, image, replyTo, messageId } = data || {};
        if (!userId || !recipientId || (!message?.trim() && !sticker && !audio && !image)) return;
        if (message && message.length > 2000) return;
        if (image && (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 200_000)) return;

        const friendIds = await getFriendIds(userId);
        if (!friendIds.includes(String(recipientId))) {
          socket.emit('error', { message: 'Получатель не в друзьях' });
          return;
        }

        const sender = await User.findById(userId);
        io.to(`user:${recipientId}`).emit('receive-message', {
          conversationId,
          messageId,
          senderId: userId,
          senderName: sender?.name,
          senderColor: sender?.color,
          text: message,
          kind: kind || 'text',
          audio: audio || null,
          audioDuration: audioDuration || 0,
          image: image || null,
          sticker,
          replyTo: replyTo || null,
          timestamp: new Date(),
        });

        // Web Push если recipient оффлайн или не в этом чате
        if (!onlineUsers.has(String(recipientId))) {
          sendPushToUser(User, recipientId, {
            title: sender?.name || 'Сообщение',
            body: kind === 'voice' ? '🎤 Голосовое сообщение' : kind === 'image' ? '📷 Фото' : (message || '').slice(0, 100),
            tag: `chat-${conversationId}`,
            conversationId,
            senderId: userId,
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Ошибка CHAT-MESSAGE:', error);
      }
    });

    socket.on('typing', (data) => {
      try {
        const { conversationId, recipientId } = data || {};
        const userId = socket.userId;
        if (!userId || !recipientId) return;
        if (onlineUsers.has(String(recipientId))) {
          io.to(`user:${recipientId}`).emit('user-typing', {
            conversationId, userId, isTyping: true,
          });
        }
      } catch (error) {}
    });

    socket.on('stop-typing', (data) => {
      try {
        const { conversationId, recipientId } = data || {};
        const userId = socket.userId;
        if (!userId || !recipientId) return;
        if (onlineUsers.has(String(recipientId))) {
          io.to(`user:${recipientId}`).emit('user-typing', {
            conversationId, userId, isTyping: false,
          });
        }
      } catch (error) {}
    });

    // ETA SHARE — пользователь шлёт другу свой ETA
    socket.on('eta-share', async (data) => {
      try {
        const userId = socket.userId;
        const { recipientId, destLat, destLng, destName, etaMinutes, etaSeconds } = data || {};
        if (!userId || !recipientId) return;
        const friendIds = await getFriendIds(userId);
        if (!friendIds.includes(String(recipientId))) return;
        const sender = await User.findById(userId);
        io.to(`user:${recipientId}`).emit('eta-update', {
          userId,
          name: sender?.name,
          destLat, destLng, destName,
          etaMinutes,
          etaSeconds,
          ts: new Date(),
        });
      } catch (error) {}
    });

    socket.on('eta-stop', async (data) => {
      try {
        const userId = socket.userId;
        const { recipientId } = data || {};
        if (!userId || !recipientId) return;
        io.to(`user:${recipientId}`).emit('eta-stopped', { userId });
      } catch (error) {}
    });

    // MEETING POINT - пригласить на середину пути
    socket.on('meeting-invite', async (data) => {
      try {
        const userId = socket.userId;
        const { recipientId, lat, lng, name } = data || {};
        if (!userId || !recipientId) return;
        const friendIds = await getFriendIds(userId);
        if (!friendIds.includes(String(recipientId))) return;
        const sender = await User.findById(userId);
        io.to(`user:${recipientId}`).emit('meeting-invite', {
          fromUserId: userId,
          fromName: sender?.name,
          lat, lng, name: name || 'Точка встречи',
        });
      } catch (error) {}
    });

    // ===== WebRTC видеозвонок: relay-сигнализация =====

    // Caller инициирует звонок → пересылаем offer получателю
    socket.on('call-user', async (data) => {
      try {
        const userId = socket.userId;
        const { to, offer, conversationId } = data || {};
        if (!userId || !to || !offer) return;

        const friendIds = await getFriendIds(userId);
        if (!friendIds.includes(String(to))) {
          socket.emit('call-error', { message: 'Получатель не в друзьях' });
          return;
        }
        if (!onlineUsers.has(String(to))) {
          socket.emit('call-error', { message: 'Пользователь не в сети', code: 'offline' });
          return;
        }

        const caller = await User.findById(userId);
        io.to(`user:${to}`).emit('incoming-call', {
          from: {
            id: userId,
            name: caller?.name,
            color: caller?.color,
            avatar: caller?.avatar,
          },
          offer,
          conversationId,
        });
      } catch (error) {
        console.error('Ошибка CALL-USER события:', error);
      }
    });

    // Callee ответил — пересылаем answer caller'у
    socket.on('call-answer', (data) => {
      const userId = socket.userId;
      const { to, answer } = data || {};
      if (!userId || !to || !answer) return;
      io.to(`user:${to}`).emit('call-answered', { from: userId, answer });
    });

    // ICE-кандидаты в обе стороны
    socket.on('ice-candidate', (data) => {
      const userId = socket.userId;
      const { to, candidate } = data || {};
      if (!userId || !to || !candidate) return;
      io.to(`user:${to}`).emit('ice-candidate', { from: userId, candidate });
    });

    // Callee отклонил звонок
    socket.on('call-reject', (data) => {
      const userId = socket.userId;
      const { to } = data || {};
      if (!userId || !to) return;
      io.to(`user:${to}`).emit('call-rejected', { from: userId });
    });

    // Любая сторона завершает звонок
    socket.on('call-end', (data) => {
      const userId = socket.userId;
      const { to } = data || {};
      if (!userId || !to) return;
      io.to(`user:${to}`).emit('call-ended', { from: userId });
    });
  });
};
