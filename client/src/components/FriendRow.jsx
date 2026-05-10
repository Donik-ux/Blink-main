import { memo, useState } from 'react';
import { Avatar } from './Avatar.jsx';
import { Trash2, MessageCircle, Edit3, Check, X } from 'lucide-react';
import { useLocationStore } from '../store/locationStore.js';
import { setFriendNickname } from '../api/friends.js';

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return null;
  const diff = Date.now() - new Date(lastSeen).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 30) return 'только что';
  if (secs < 60) return `${secs}с назад`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
};

const speedLabel = (speed) => {
  if (speed === null || speed === undefined) return null;
  const kmh = speed * 3.6;
  if (kmh < 0.5) return null;
  return `${kmh.toFixed(1)} км/ч`;
};

const FriendRowImpl = ({ friend, onDelete, onMessage }) => {
  const friendId = friend.id || friend._id;
  const locationData = useLocationStore((s) => s.friendLocations.get(friendId));

  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState(friend.nickname || '');

  const distanceText = friend.distance && friend.distance.unit === 'м'
    ? `${friend.distance.value} м`
    : friend.distance ? `${friend.distance.value} ${friend.distance.unit}` : '—';

  const isOnline = !!friend.online;
  const speed = locationData?.speed ?? friend.location?.speed ?? null;
  const speedText = isOnline ? speedLabel(speed) : null;
  const lastSeenText = !isOnline ? formatLastSeen(friend.lastSeen) : null;

  const statusColor = friend.ghostMode
    ? 'bg-ghost'
    : isOnline ? 'bg-online shadow-[0_0_8px_rgba(0,255,65,0.6)]' : 'bg-offline';

  const address = locationData?.address || friend.location?.address;
  const displayName = friend.nickname || friend.name;

  const saveNick = async () => {
    try {
      await setFriendNickname(friendId, nick.trim());
    } catch {}
    setEditingNick(false);
  };

  return (
    <div className="press group flex items-center gap-3 p-3 bg-surface/50 hover:bg-surface/70 border border-white/5 rounded-2xl">
      <div className="relative shrink-0">
        <Avatar name={displayName} color={friend.color} avatar={friend.avatar} size="md" />
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bg ${statusColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        {editingNick ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={40}
              placeholder={friend.name}
              className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-white flex-1 min-w-0"
            />
            <button onClick={saveNick} className="p-1 text-emerald-400"><Check size={14} /></button>
            <button onClick={() => { setEditingNick(false); setNick(friend.nickname || ''); }} className="p-1 text-white/50"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm truncate">{displayName}</p>
            {friend.nickname && <span className="text-white/40 text-[10px] truncate">({friend.name})</span>}
            {friend.distance && (
              <span className="text-accent text-xs font-bold shrink-0">{distanceText}</span>
            )}
            {speedText && (
              <span className="text-emerald-400 text-[10px] font-bold shrink-0">· {speedText}</span>
            )}
          </div>
        )}
        {friend.mood && (
          <p className="text-white/50 text-[11px] truncate mt-0.5">{friend.moodEmoji || '💬'} {friend.mood}</p>
        )}
        <p className="text-white/40 text-[11px] truncate mt-0.5">
          {!isOnline && lastSeenText ? `В сети ${lastSeenText}` : address || (isOnline ? 'Онлайн' : 'Оффлайн')}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setEditingNick(true)} className="press w-9 h-9 flex items-center justify-center hover:bg-white/5 rounded-xl text-white/40" aria-label="nickname">
          <Edit3 size={14} />
        </button>
        {onMessage && (
          <button onClick={() => onMessage(friend)} className="press w-10 h-10 flex items-center justify-center hover:bg-accent/10 rounded-xl text-accent">
            <MessageCircle size={18} />
          </button>
        )}
        <button onClick={() => onDelete(friend.id)} className="press w-10 h-10 flex items-center justify-center hover:bg-red-500/10 rounded-xl text-white/30 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export const FriendRow = memo(FriendRowImpl);
