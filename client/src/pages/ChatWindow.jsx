import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, RotateCcw, Smile, Mic, Trash2, Edit2, X, Check, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '../utils/image.js';
import {
  getMessages, sendMessage, markAsRead,
  reactToMessage, editMessage, deleteMessage,
} from '../api/chat.js';
import { useAuthStore } from '../store/authStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { Avatar } from '../components/Avatar.jsx';
import { Toast } from '../components/Toast.jsx';
import { useT } from '../i18n/index.js';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];

const getUserIdFromToken = () => {
  try {
    const t = useAuthStore.getState().token;
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1]));
    return payload.id || null;
  } catch { return null; }
};

const sameDay = (a, b) => {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};
const formatDateLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Сегодня';
  if (sameDay(d, yesterday)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};
const formatTime = (date) =>
  new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Преобразуем seenBy объект/Map к массиву userId
const seenByList = (seenBy) => {
  if (!seenBy) return [];
  if (seenBy instanceof Map) return Array.from(seenBy.keys());
  if (typeof seenBy === 'object') return Object.keys(seenBy);
  return [];
};
const reactionsList = (reactions) => {
  if (!reactions) return {};
  if (reactions instanceof Map) return Object.fromEntries(reactions);
  if (typeof reactions === 'object') return reactions;
  return {};
};

export const ChatWindow = () => {
  const t = useT();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const friend = location.state?.friend;
  const conversation = location.state?.conversation;
  const isGroup = conversation?.kind === 'group';

  const currentUser = useAuthStore((state) => state.currentUser);
  const myId = useMemo(() => currentUser?.id || getUserIdFromToken(), [currentUser]);
  const { socket } = useSocket();

  const typingClearRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionsFor, setActionsFor] = useState(null); // messageId
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStartRef = useRef(0);

  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const scrollToBottom = (behavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  };

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      setToast({ message: t('error'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [conversationId, t]);

  useEffect(() => {
    loadMessages();
    markAsRead(conversationId).catch(() => {});
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (!loading) scrollToBottom('auto');
  }, [loading]);

  useEffect(() => {
    if (!socket) return;

    const onReceive = (data) => {
      if (data.conversationId !== conversationId) return;
      const wasNearBottom = isNearBottom();
      setMessages((prev) => [
        ...prev,
        {
          _id: data.messageId || `sock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          senderId: { _id: data.senderId, name: data.senderName, color: data.senderColor },
          text: data.text || '',
          kind: data.kind || 'text',
          audio: data.audio || null,
          audioDuration: data.audioDuration || 0,
          replyTo: data.replyTo,
          createdAt: data.timestamp,
        },
      ]);
      markAsRead(conversationId).catch(() => {});
      if (wasNearBottom) scrollToBottom();
    };

    const onTyping = (data) => {
      if (data.conversationId !== conversationId) return;
      if (data.isTyping) {
        setIsTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setIsTyping(false), 4000);
      } else {
        setIsTyping(false);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
      }
    };

    const onReaction = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m))
      );
    };

    const onEdited = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(data.messageId)
            ? { ...m, text: data.text, editedAt: data.editedAt }
            : m
        )
      );
    };

    const onDeleted = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(data.messageId)
            ? { ...m, deleted: true, text: '', audio: null }
            : m
        )
      );
    };

    const onSeen = (data) => {
      if (data.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (String(m.senderId?._id || m.senderId) !== String(myId)) return m;
          const sb = reactionsList(m.seenBy); // re-use helper
          if (sb[data.seenBy]) return m;
          return { ...m, seenBy: { ...sb, [data.seenBy]: data.seenAt } };
        })
      );
    };

    socket.on('receive-message', onReceive);
    socket.on('user-typing', onTyping);
    socket.on('message-reaction', onReaction);
    socket.on('message-edited', onEdited);
    socket.on('message-deleted', onDeleted);
    socket.on('messages-seen', onSeen);

    return () => {
      socket.off('receive-message', onReceive);
      socket.off('user-typing', onTyping);
      socket.off('message-reaction', onReaction);
      socket.off('message-edited', onEdited);
      socket.off('message-deleted', onDeleted);
      socket.off('messages-seen', onSeen);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, [conversationId, socket, myId]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !friend || isGroup) return;
    socket.emit('typing', { conversationId, recipientId: friend.id || friend._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { conversationId, recipientId: friend.id || friend._id });
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      senderId: { _id: myId, name: currentUser?.name },
      text, kind: 'text',
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');
    setSending(true);
    if (navigator.vibrate) navigator.vibrate(8);
    scrollToBottom();

    const recipientId = friend?.id || friend?._id;

    try {
      const msg = await sendMessage(conversationId, text);
      setMessages((prev) => prev.map((m) => (m._id === tempId ? msg : m)));
      if (socket && recipientId && !isGroup) {
        socket.emit('chat-message', {
          conversationId, message: text, recipientId, kind: 'text', messageId: msg._id,
        });
        socket.emit('stop-typing', { conversationId, recipientId });
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, pending: false, failed: true } : m))
      );
      setToast({ message: t('chat_send_failed'), type: 'error' });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const retryFailed = async (failedMsg) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === failedMsg._id ? { ...m, pending: true, failed: false } : m))
    );
    try {
      const msg = await sendMessage(conversationId, failedMsg.text);
      setMessages((prev) => prev.map((m) => (m._id === failedMsg._id ? msg : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._id === failedMsg._id ? { ...m, pending: false, failed: true } : m))
      );
    }
  };

  const onReact = async (msgId, emoji) => {
    setActionsFor(null);
    try {
      await reactToMessage(msgId, emoji);
    } catch {
      setToast({ message: t('error'), type: 'error' });
    }
  };

  const onDelete = async (msgId) => {
    setActionsFor(null);
    try {
      await deleteMessage(msgId);
    } catch {}
  };

  const startEdit = (msg) => {
    setActionsFor(null);
    setEditingId(msg._id);
    setEditText(msg.text || '');
  };

  const submitEdit = async () => {
    if (!editingId || !editText.trim()) { setEditingId(null); return; }
    try {
      await editMessage(editingId, editText.trim());
      setMessages((prev) => prev.map((m) => (m._id === editingId ? { ...m, text: editText.trim(), editedAt: new Date() } : m)));
    } catch {
      setToast({ message: t('error'), type: 'error' });
    } finally {
      setEditingId(null);
      setEditText('');
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordChunksRef.current = [];
      recordStartRef.current = Date.now();
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const dur = Math.round((Date.now() - recordStartRef.current) / 1000);
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0 || dur < 1) return;
        // Лимит 60 секунд
        if (dur > 60) {
          setToast({ message: 'Слишком длинное аудио', type: 'error' });
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result;
          // ~limit 400KB after base64
          if (dataUrl.length > 400_000) {
            setToast({ message: 'Слишком большой файл', type: 'error' });
            return;
          }
          try {
            const msg = await sendMessage(conversationId, '', { kind: 'voice', audio: dataUrl, audioDuration: dur });
            setMessages((prev) => [...prev, msg]);
            if (socket && friend && !isGroup) {
              socket.emit('chat-message', {
                conversationId,
                recipientId: friend.id || friend._id,
                kind: 'voice',
                audio: dataUrl,
                audioDuration: dur,
                messageId: msg._id,
              });
            }
            scrollToBottom();
          } catch {
            setToast({ message: t('chat_send_failed'), type: 'error' });
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setToast({ message: 'Нет доступа к микрофону', type: 'error' });
    }
  };
  const stopRecording = () => {
    setRecording(false);
    try { recorderRef.current?.stop(); } catch {}
  };

  // Image upload
  const imageInputRef = useRef(null);
  const handlePickImage = () => imageInputRef.current?.click();
  const handleImageChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, { maxSize: 1024, quality: 0.78, maxBytes: 180_000, square: false });
      if (dataUrl.length > 200_000) {
        setToast({ message: 'Картинка слишком большая', type: 'error' });
        return;
      }
      const msg = await sendMessage(conversationId, '', { kind: 'image', image: dataUrl });
      setMessages((prev) => [...prev, msg]);
      if (socket && friend && !isGroup) {
        socket.emit('chat-message', {
          conversationId,
          recipientId: friend.id || friend._id,
          kind: 'image',
          image: dataUrl,
          messageId: msg._id,
        });
      }
      scrollToBottom();
    } catch (err) {
      setToast({ message: 'Ошибка отправки фото', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-bg flex items-center justify-center safe-top">
        <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  const renderItems = [];
  let lastDate = null;
  messages.forEach((msg, idx) => {
    const created = msg.createdAt || new Date();
    if (!lastDate || !sameDay(lastDate, created)) {
      renderItems.push({ kind: 'day', key: `day-${idx}`, label: formatDateLabel(created) });
      lastDate = created;
    }
    renderItems.push({ kind: 'msg', key: msg._id || idx, msg });
  });

  const titleText = isGroup ? (conversation?.title || 'Группа') : (friend?.nickname || friend?.name || 'Чат');
  const subText = isGroup
    ? `${conversation?.participants?.length || 0} ${t('chat_group_members').toLowerCase()}`
    : (isTyping ? t('typing') : (friend?.online ? t('online') : t('offline')));

  return (
    <div className="w-full h-screen bg-bg flex flex-col">
      <div className="sticky top-0 z-30 bg-bg/85 backdrop-blur-2xl border-b border-white/5 safe-top">
        <div className="flex items-center gap-3 px-3 py-2.5 max-w-2xl mx-auto w-full">
          <button onClick={() => navigate(-1)} className="press w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-colors text-white/80" aria-label={t('back')}>
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              <Avatar name={titleText} color={friend?.color || '#7c3aed'} size="sm" avatar={friend?.avatar} />
              {!isGroup && friend?.online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-online border-2 border-bg shadow-[0_0_6px_rgba(0,255,65,0.7)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold truncate text-[15px] leading-tight">{titleText}</p>
              <p className={`text-[11px] mt-0.5 truncate ${isTyping ? 'text-accent' : 'text-white/40'}`}>{subText}</p>
              {!isGroup && friend?.mood && (
                <p className="text-[11px] text-white/40 truncate">{friend.moodEmoji || ''} {friend.mood}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Список */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
              <Send size={20} className="text-accent" />
            </div>
            <p className="text-white/70 font-semibold text-sm mb-1">{t('chat_start')} 👋</p>
            <p className="text-white/40 text-xs">{t('chat_first_message')}</p>
          </div>
        ) : (
          renderItems.map((item) => {
            if (item.kind === 'day') {
              return (
                <div key={item.key} className="flex justify-center my-3">
                  <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full">{item.label}</span>
                </div>
              );
            }
            const msg = item.msg;
            const senderId = typeof msg.senderId === 'object' ? msg.senderId?._id : msg.senderId;
            const isOwn = String(senderId) === String(myId);
            const senderName = typeof msg.senderId === 'object' ? msg.senderId?.name : '';
            const reactions = reactionsList(msg.reactions);
            const reactionGroups = {};
            for (const e of Object.values(reactions)) reactionGroups[e] = (reactionGroups[e] || 0) + 1;
            const seenCount = seenByList(msg.seenBy).length;

            if (msg.deleted) {
              return (
                <div key={item.key} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className="px-3 py-1.5 rounded-2xl bg-white/5 text-white/40 text-[13px] italic">{t('chat_message_deleted')}</div>
                </div>
              );
            }

            return (
              <div key={item.key} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-fadeIn`}>
                {isGroup && !isOwn && senderName && (
                  <p className="text-[11px] font-semibold mb-0.5 ml-2" style={{ color: typeof msg.senderId === 'object' ? msg.senderId?.color : '#7c3aed' }}>{senderName}</p>
                )}
                <div
                  className={`relative max-w-[78%] sm:max-w-[65%] px-3.5 py-2 rounded-2xl ${
                    isOwn
                      ? `bg-gradient-to-br from-accent to-accent/85 text-black ${msg.failed ? 'from-red-500 to-red-600 text-white' : ''} ${msg.pending ? 'opacity-70' : ''}`
                      : 'bg-surface2 text-white border border-white/5'
                  } ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'} shadow-sm`}
                  onClick={() => msg.failed ? retryFailed(msg) : null}
                  onContextMenu={(e) => { e.preventDefault(); setActionsFor(msg._id); }}
                  onDoubleClick={() => setActionsFor(msg._id)}
                  style={{ cursor: msg.failed ? 'pointer' : 'default' }}
                >
                  {editingId === msg._id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="bg-black/20 text-current outline-none px-2 py-1 rounded text-[14px] min-w-[120px]"
                      />
                      <button onClick={submitEdit} className="p-1"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1"><X size={14} /></button>
                    </div>
                  ) : msg.kind === 'voice' && msg.audio ? (
                    <div className="flex items-center gap-2">
                      <audio controls src={msg.audio} className="h-8 max-w-[200px]" />
                      <span className={`text-[10px] ${isOwn ? 'text-black/60' : 'text-white/50'}`}>{msg.audioDuration || 0}с</span>
                    </div>
                  ) : msg.kind === 'image' && msg.image ? (
                    <a href={msg.image} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.image}
                        alt=""
                        loading="lazy"
                        className="rounded-xl max-w-[240px] max-h-[300px] object-cover"
                      />
                    </a>
                  ) : (
                    <p className="break-words text-[14.5px] leading-snug whitespace-pre-wrap">{msg.text}</p>
                  )}
                  <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isOwn ? (msg.failed ? 'text-white/80' : 'text-black/60') : 'text-white/40'} ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {msg.editedAt && <span className="italic">{t('chat_edited')}</span>}
                    {msg.failed ? (<><RotateCcw size={10} />{t('chat_send_failed')}</>) : msg.pending ? 'отправка…' : formatTime(msg.createdAt)}
                    {isOwn && !msg.pending && !msg.failed && (
                      <span className="ml-0.5">{seenCount > 0 ? '✓✓' : '✓'}</span>
                    )}
                  </p>
                </div>
                {Object.keys(reactionGroups).length > 0 && (
                  <div className={`flex gap-1 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                    {Object.entries(reactionGroups).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => onReact(msg._id, emoji)}
                        className="bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-[12px] flex items-center gap-1 hover:bg-white/12"
                      >
                        <span>{emoji}</span>{count > 1 && <span className="text-white/60">{count}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {actionsFor === msg._id && (
                  <div className={`flex gap-1 mt-1 bg-surface2 border border-white/10 rounded-2xl p-1.5 shadow-lg ${isOwn ? 'mr-1' : 'ml-1'}`}>
                    {REACTIONS.slice(0, 6).map((e) => (
                      <button key={e} onClick={() => onReact(msg._id, e)} className="press text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">{e}</button>
                    ))}
                    {isOwn && msg.kind === 'text' && (
                      <button onClick={() => startEdit(msg)} className="press w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70"><Edit2 size={14} /></button>
                    )}
                    {isOwn && (
                      <button onClick={() => onDelete(msg._id)} className="press w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-red-400"><Trash2 size={14} /></button>
                    )}
                    <button onClick={() => setActionsFor(null)} className="press w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40"><X size={14} /></button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-white/5 bg-bg/95 backdrop-blur-xl safe-bottom">
        <div className="flex gap-2 px-3 py-2.5 max-w-2xl mx-auto items-center">
          {recording ? (
            <>
              <div className="flex-1 flex items-center gap-2 px-4">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white/80 text-sm">{t('chat_voice_recording')}</span>
              </div>
              <button type="button" onClick={stopRecording} className="press w-11 h-11 flex items-center justify-center bg-accent text-black rounded-2xl font-bold">
                <Send size={18} />
              </button>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder={t('chat_message_placeholder')}
                maxLength={2000}
                className="flex-1 bg-surface/80 border border-white/10 rounded-2xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-accent transition-colors text-[15px]"
              />
              {!newMessage.trim() && (
                <>
                  <button type="button" onClick={handlePickImage} className="press w-11 h-11 flex items-center justify-center bg-white/10 text-white rounded-2xl shrink-0" aria-label="Фото">
                    <ImageIcon size={18} />
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChosen}
                  />
                  <button type="button" onClick={startRecording} className="press w-11 h-11 flex items-center justify-center bg-white/10 text-white rounded-2xl shrink-0">
                    <Mic size={18} />
                  </button>
                </>
              )}
              <button type="submit" disabled={!newMessage.trim() || sending} className="press w-11 h-11 flex items-center justify-center bg-accent text-black rounded-2xl font-bold shrink-0 transition-all disabled:opacity-30 disabled:bg-white/10 disabled:text-white/40 enabled:shadow-[0_4px_16px_rgba(0,217,255,0.35)]" aria-label={t('chat_message_placeholder')}>
                <Send size={18} className={sending ? 'animate-pulse' : ''} />
              </button>
            </>
          )}
        </div>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};
