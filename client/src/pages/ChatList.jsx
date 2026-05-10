import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Search, Plus, Users } from 'lucide-react';
import { getConversations } from '../api/chat.js';
import { useAuthStore } from '../store/authStore.js';
import { Avatar } from '../components/Avatar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { useT } from '../i18n/index.js';
import { StoriesRibbon } from '../components/StoriesRibbon.jsx';

const getUserIdFromToken = () => {
  try {
    const t = useAuthStore.getState().token;
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1]));
    return payload.id || null;
  } catch { return null; }
};

const formatPreviewTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
};

export const ChatList = () => {
  const t = useT();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const currentUser = useAuthStore((state) => state.currentUser);
  const myId = useMemo(() => currentUser?.id || getUserIdFromToken(), [currentUser]);
  const { socket } = useSocket();

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (data) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === data.conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const updated = { ...prev[idx] };
        updated.lastMessage = data.text || (data.kind === 'voice' ? '🎤 Голосовое' : (data.sticker ? '🎨 Стикер' : ''));
        updated.lastMessageTime = data.timestamp || new Date();
        updated.lastMessageSenderId = data.senderId;
        const unread = updated.unreadCount?.[myId] || 0;
        updated.unreadCount = { ...(updated.unreadCount || {}), [myId]: unread + 1 };
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    };
    const onGroupCreated = () => { loadConversations(); };
    socket.on('receive-message', onMessage);
    socket.on('group-created', onGroupCreated);
    return () => {
      socket.off('receive-message', onMessage);
      socket.off('group-created', onGroupCreated);
    };
  }, [socket, myId]);

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOtherParticipant = (c) => c.participants.find((p) => String(p._id) !== String(myId));
  const getDisplay = (c) => {
    if (c.kind === 'group') {
      return {
        name: c.title || 'Группа',
        color: '#7c3aed',
        avatar: c.avatar,
        isGroup: true,
        meta: `${c.participants?.length || 0} участников`,
      };
    }
    const f = getOtherParticipant(c);
    return f ? {
      name: f.name,
      color: f.color,
      avatar: f.avatar,
      mood: f.mood,
      moodEmoji: f.moodEmoji,
    } : null;
  };
  const getUnread = (c) => c.unreadCount?.[myId] || 0;

  const handleOpenChat = (c) => {
    if (navigator.vibrate) navigator.vibrate(8);
    if (c.kind === 'group') {
      navigate(`/chat/${c._id}`, { state: { conversation: c } });
    } else {
      const friend = getOtherParticipant(c);
      navigate(`/chat/${c._id}`, { state: { friend, conversation: c } });
    }
  };

  const filtered = useMemo(() => {
    const list = conversations
      .map((c) => ({ c, display: getDisplay(c) }))
      .filter((x) => x.display);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (x) =>
        x.display.name?.toLowerCase().includes(q) ||
        (x.c.lastMessage || '').toLowerCase().includes(q)
    );
  }, [conversations, query, myId]);

  const totalUnread = conversations.reduce((sum, c) => sum + getUnread(c), 0);

  return (
    <div className="min-h-screen bg-bg pb-32">
      <div className="sticky top-0 z-40 glass safe-top border-b border-border">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="press p-2 -ml-2 rounded-xl hover:bg-surface" aria-label={t('back')}>
              <ArrowLeft size={22} className="text-accent" />
            </button>
            <h1 className="text-xl font-bold text-white flex-1">{t('nav_chats')}</h1>
            <button onClick={() => navigate('/chats/new-group')} className="press p-2 rounded-xl hover:bg-surface" aria-label={t('chat_create_group')}>
              <Users size={20} className="text-accent" />
            </button>
            {totalUnread > 0 && (
              <span className="bg-accent text-black text-xs font-bold rounded-full px-2.5 py-1">{totalUnread > 99 ? '99+' : totalUnread}</span>
            )}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-muted text-base focus:outline-none focus:border-accent" />
          </div>
        </div>
      </div>

      <StoriesRibbon />

      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-surface rounded" />
                  <div className="h-3 w-2/3 bg-surface rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface mb-4">
              <MessageCircle size={32} className="text-muted opacity-60" />
            </div>
            <p className="text-white font-medium mb-1">{query ? 'Ничего не найдено' : 'Нет сообщений'}</p>
            <p className="text-muted text-sm">{query ? 'Попробуй другое имя или текст' : 'Открой друга и напиши первое сообщение'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(({ c, display }) => {
              const unread = getUnread(c);
              const isUnread = unread > 0;
              return (
                <button
                  key={c._id}
                  onClick={() => handleOpenChat(c)}
                  className={`press w-full text-left card transition-all active:scale-[0.99] ${isUnread ? 'border-accent/40 bg-surface/60' : 'hover:border-accent/30'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {display.isGroup ? (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent2 to-accent3 flex items-center justify-center">
                          <Users size={20} className="text-white" />
                        </div>
                      ) : (
                        <Avatar name={display.name} color={display.color} avatar={display.avatar} size="md" />
                      )}
                      {isUnread && (
                        <div className="absolute -top-1 -right-1 bg-accent text-black text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg shadow-accent/30">
                          {unread > 9 ? '9+' : unread}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`truncate ${isUnread ? 'text-white font-semibold' : 'text-white font-medium'}`}>{display.name}</p>
                        {c.lastMessageTime && (
                          <span className={`text-xs flex-shrink-0 ${isUnread ? 'text-accent font-medium' : 'text-muted'}`}>
                            {formatPreviewTime(c.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${isUnread ? 'text-white/80' : 'text-muted'}`}>
                        {c.lastMessage || (display.isGroup ? display.meta : 'Нет сообщений')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
