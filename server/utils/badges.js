import Friendship from '../models/Friendship.js';
import CheckIn from '../models/CheckIn.js';
import Steps from '../models/Steps.js';

// Каталог badge'ов
export const BADGES = {
  first_friend: { title: 'Первый друг', emoji: '🤝', desc: 'Добавил первого друга' },
  social_5: { title: 'Социальный', emoji: '👥', desc: '5 друзей' },
  social_10: { title: 'Популярный', emoji: '🌟', desc: '10 друзей' },
  first_checkin: { title: 'Первая отметка', emoji: '📍', desc: 'Первый чек-ин' },
  explorer_10: { title: 'Исследователь', emoji: '🗺️', desc: '10 чек-инов' },
  walker_10k: { title: 'Шагомер', emoji: '🚶', desc: '10 000 шагов за день' },
  walker_50k: { title: 'Марафонец', emoji: '🏃', desc: '50 000 шагов суммарно' },
  ghost_master: { title: 'Призрак', emoji: '👻', desc: 'Включил режим призрака' },
  night_owl: { title: 'Сова', emoji: '🦉', desc: 'Активность ночью' },
  early_bird: { title: 'Ранняя пташка', emoji: '🐦', desc: 'Активность утром' },
};

// Возвращает список новых разблокированных badge id
export const checkBadges = async (user, io) => {
  if (!user) return [];
  const owned = new Set(user.badges || []);
  const earned = [];

  const grant = (id) => {
    if (!owned.has(id) && BADGES[id]) {
      owned.add(id);
      earned.push(id);
    }
  };

  // Friends
  const friendsCount = await Friendship.countDocuments({
    $or: [{ requester: user._id }, { recipient: user._id }],
    status: 'accepted',
  });
  if (friendsCount >= 1) grant('first_friend');
  if (friendsCount >= 5) grant('social_5');
  if (friendsCount >= 10) grant('social_10');

  // Check-ins
  const checkinCount = await CheckIn.countDocuments({ userId: user._id });
  if (checkinCount >= 1) grant('first_checkin');
  if (checkinCount >= 10) grant('explorer_10');

  // Steps
  const allSteps = await Steps.find({ userId: user._id });
  const total = allSteps.reduce((s, x) => s + (x.count || 0), 0);
  const maxDaily = allSteps.reduce((m, x) => Math.max(m, x.count || 0), 0);
  if (maxDaily >= 10000) grant('walker_10k');
  if (total >= 50000) grant('walker_50k');

  if (user.ghostMode) grant('ghost_master');

  // Time-based
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) grant('night_owl');
  if (hour >= 5 && hour < 8) grant('early_bird');

  if (earned.length > 0) {
    user.badges = Array.from(owned);
    await user.save();
    if (io) {
      io.to(`user:${user._id}`).emit('badges-unlocked', {
        badges: earned.map((id) => ({ id, ...BADGES[id] })),
      });
    }
  }
  return earned.map((id) => ({ id, ...BADGES[id] }));
};
