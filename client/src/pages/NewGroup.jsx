import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Check } from 'lucide-react';
import { getFriends } from '../api/friends.js';
import { createGroup } from '../api/chat.js';
import { useT } from '../i18n/index.js';
import { Avatar } from '../components/Avatar.jsx';

export const NewGroup = () => {
  const t = useT();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => { try { setFriends(await getFriends()); } catch {} })();
  }, []);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    if (!title.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      const conv = await createGroup(title.trim(), Array.from(selected));
      navigate(`/chat/${conv._id}`, { state: { conversation: conv } });
    } catch (err) {
      console.warn(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24 safe-top">
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="press p-2 -ml-1"><ArrowLeft size={22} className="text-accent" /></button>
          <h1 className="text-xl font-bold text-white flex-1">{t('chat_create_group')}</h1>
          <button onClick={submit} disabled={!title.trim() || selected.size === 0 || creating} className="press p-2 bg-accent rounded-xl text-black disabled:opacity-30 font-bold text-sm px-3">
            {t('create')}
          </button>
        </div>
      </div>

      <div className="p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('chat_group_title')} maxLength={60} className="mb-4" />
        <p className="text-white/60 text-sm mb-2">{t('chat_group_members')} ({selected.size})</p>
        <div className="space-y-2">
          {friends.map((f) => (
            <button key={f.id} onClick={() => toggle(f.id)} className={`press w-full text-left flex items-center gap-3 p-3 rounded-xl transition ${selected.has(f.id) ? 'bg-accent/15 border border-accent/40' : 'bg-white/5 border border-transparent'}`}>
              <Avatar name={f.name} color={f.color} avatar={f.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{f.nickname || f.name}</p>
                {f.online && <p className="text-online text-[11px]">{t('online')}</p>}
              </div>
              {selected.has(f.id) && <Check size={20} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
