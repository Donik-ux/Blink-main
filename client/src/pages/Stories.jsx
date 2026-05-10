import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Image as ImageIcon, Type, Send, Trash2 } from 'lucide-react';
import { getStoriesFeed, createStory, viewStory, deleteStory } from '../api/stories.js';
import { useAuthStore } from '../store/authStore.js';
import { useT } from '../i18n/index.js';
import { Avatar } from '../components/Avatar.jsx';
import { compressImage } from '../utils/image.js';

const BG_COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706', '#dc2626', '#2563eb', '#9333ea'];

export const Stories = () => {
  const t = useT();
  const navigate = useNavigate();
  const { state } = useLocation();
  const initialUser = state?.initialUser;
  const currentUser = useAuthStore((s) => s.currentUser);
  const [feed, setFeed] = useState([]);
  const [activeUserIdx, setActiveUserIdx] = useState(0);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState('text');
  const [text, setText] = useState('');
  const [imageData, setImageData] = useState(null);
  const [bg, setBg] = useState(BG_COLORS[0]);
  const fileInputRef = useRef(null);
  const progressRef = useRef(null);

  const load = async () => {
    try {
      const data = await getStoriesFeed();
      setFeed(data || []);
      if (initialUser) {
        const idx = data.findIndex((u) => String(u.userId) === String(initialUser));
        if (idx >= 0) setActiveUserIdx(idx);
      }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  // Авто-переход 5с
  useEffect(() => {
    if (creating) return;
    if (feed.length === 0) return;
    const user = feed[activeUserIdx];
    if (!user) return;
    const story = user.stories?.[activeStoryIdx];
    if (!story) return;
    if (!story.seen && String(user.userId) !== String(currentUser?.id)) {
      viewStory(story._id).catch(() => {});
    }
    const timer = setTimeout(next, 5000);
    return () => clearTimeout(timer);
  }, [feed, activeUserIdx, activeStoryIdx, creating]);

  const next = () => {
    const user = feed[activeUserIdx];
    if (!user) return;
    if (activeStoryIdx + 1 < user.stories.length) {
      setActiveStoryIdx(activeStoryIdx + 1);
    } else if (activeUserIdx + 1 < feed.length) {
      setActiveUserIdx(activeUserIdx + 1);
      setActiveStoryIdx(0);
    } else {
      navigate(-1);
    }
  };
  const prev = () => {
    if (activeStoryIdx > 0) setActiveStoryIdx(activeStoryIdx - 1);
    else if (activeUserIdx > 0) {
      const prevUser = feed[activeUserIdx - 1];
      setActiveUserIdx(activeUserIdx - 1);
      setActiveStoryIdx((prevUser?.stories?.length || 1) - 1);
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file, { maxSize: 720, quality: 0.7 });
      setImageData(data);
    } catch (err) {
      console.warn(err);
    }
  };

  const submit = async () => {
    try {
      const body = createMode === 'image'
        ? { kind: 'image', image: imageData, text }
        : { kind: 'text', text, bgColor: bg };
      await createStory(body);
      setCreating(false);
      setText(''); setImageData(null);
      await load();
    } catch (err) {
      console.warn(err);
    }
  };

  const onDelete = async (id) => {
    if (!confirm(t('delete') + '?')) return;
    try {
      await deleteStory(id);
      await load();
    } catch {}
  };

  if (creating) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col safe-top safe-bottom">
        <div className="flex items-center gap-3 p-3">
          <button onClick={() => setCreating(false)} className="press p-2"><X size={22} className="text-white" /></button>
          <div className="flex-1" />
          <button onClick={submit} disabled={createMode === 'text' ? !text.trim() : !imageData} className="press bg-accent text-black font-bold rounded-full px-4 py-1.5 disabled:opacity-30">
            <Send size={16} className="inline mr-1" /> Опубликовать
          </button>
        </div>
        <div className="flex justify-center gap-2 mb-3">
          <button onClick={() => setCreateMode('text')} className={`px-3 py-1.5 rounded-full text-sm ${createMode === 'text' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
            <Type size={14} className="inline mr-1" /> {t('stories_text_mode')}
          </button>
          <button onClick={() => setCreateMode('image')} className={`px-3 py-1.5 rounded-full text-sm ${createMode === 'image' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
            <ImageIcon size={14} className="inline mr-1" /> {t('stories_photo_mode')}
          </button>
        </div>
        {createMode === 'text' ? (
          <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: bg }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('stories_text_placeholder')}
              maxLength={240}
              autoFocus
              className="w-full max-w-md bg-transparent text-white text-2xl text-center placeholder-white/50 outline-none resize-none font-bold"
              rows={6}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-3 bg-black">
            {imageData ? (
              <div className="relative">
                <img src={imageData} alt="" className="max-h-[60vh] rounded-2xl" />
                <button onClick={() => setImageData(null)} className="absolute top-2 right-2 bg-black/60 rounded-full p-2"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="press w-32 h-32 border-2 border-dashed border-white/30 rounded-2xl flex items-center justify-center text-white">
                <ImageIcon size={32} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} hidden />
          </div>
        )}
        {createMode === 'text' && (
          <div className="flex justify-center gap-2 p-4">
            {BG_COLORS.map((c) => (
              <button key={c} onClick={() => setBg(c)} className={`w-7 h-7 rounded-full border-2 ${bg === c ? 'border-white' : 'border-white/30'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center safe-top safe-bottom">
        <p className="text-white/60 mb-4">{t('stories_no_stories')}</p>
        <button onClick={() => setCreating(true)} className="press bg-accent text-black font-bold rounded-full px-6 py-2">
          {t('stories_add')}
        </button>
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 press p-2"><X size={22} className="text-white" /></button>
      </div>
    );
  }

  const user = feed[activeUserIdx];
  const story = user?.stories?.[activeStoryIdx];
  const isMine = String(user?.userId) === String(currentUser?.id);

  if (!story) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center safe-top safe-bottom">
        <p className="text-white/60 mb-4">У {user?.name} пока нет историй</p>
        {isMine && (
          <button onClick={() => setCreating(true)} className="press bg-accent text-black font-bold rounded-full px-6 py-2">
            {t('stories_add')}
          </button>
        )}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 press p-2"><X size={22} className="text-white" /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col safe-top safe-bottom">
      <div className="flex gap-1 p-2">
        {user.stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full bg-white transition-all ${i < activeStoryIdx ? 'w-full' : i === activeStoryIdx ? 'w-1/2' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <Avatar name={user.name} color={user.color} avatar={user.avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">{user.name}</p>
          <p className="text-white/50 text-[11px]">{new Date(story.createdAt).toLocaleString()}</p>
        </div>
        {isMine && (
          <button onClick={() => onDelete(story._id)} className="press p-2 text-white/70"><Trash2 size={18} /></button>
        )}
        <button onClick={() => navigate(-1)} className="press p-2"><X size={22} className="text-white" /></button>
      </div>

      <div className="flex-1 relative flex items-center justify-center" style={{ backgroundColor: story.kind === 'text' ? story.bgColor : '#000' }}>
        {story.kind === 'text' ? (
          <p className="text-white text-2xl font-bold text-center px-6 max-w-md">{story.text}</p>
        ) : (
          <img src={story.image} alt="" className="max-h-full max-w-full object-contain" />
        )}
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="prev" />
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/3" aria-label="next" />
      </div>

      <div className="p-3 flex items-center gap-2">
        {isMine && (
          <button onClick={() => setCreating(true)} className="press bg-accent text-black font-bold rounded-full px-4 py-2 text-sm">
            <ImageIcon size={14} className="inline mr-1" /> {t('stories_add')}
          </button>
        )}
        {isMine && story.viewers?.length > 0 && (
          <div className="text-white/60 text-xs">{t('stories_seen_by')}: {story.viewers.length}</div>
        )}
      </div>
    </div>
  );
};
