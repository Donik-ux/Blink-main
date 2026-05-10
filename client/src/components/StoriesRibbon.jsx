import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getStoriesFeed } from '../api/stories.js';
import { Avatar } from './Avatar.jsx';
import { useAuthStore } from '../store/authStore.js';

export const StoriesRibbon = () => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const myId = currentUser?.id;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await getStoriesFeed();
        if (!cancel) setFeed(data || []);
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  const myStory = feed.find((u) => String(u.userId) === String(myId));
  const others = feed.filter((u) => String(u.userId) !== String(myId));

  return (
    <div className="px-4 py-3 overflow-x-auto no-scrollbar border-b border-white/5">
      <div className="flex gap-3 items-center">
        <button onClick={() => navigate('/stories', { state: { initialUser: myId } })} className="press flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <Avatar name={currentUser?.name || 'Я'} color={currentUser?.color || '#7c3aed'} avatar={currentUser?.avatar} size="md" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center border-2 border-bg">
              <Plus size={12} className="text-black" />
            </div>
          </div>
          <span className="text-[11px] text-white/70 max-w-[60px] truncate">Твоя</span>
        </button>
        {others.map((u) => (
          <button key={u.userId} onClick={() => navigate('/stories', { state: { initialUser: u.userId } })} className="press flex flex-col items-center gap-1 shrink-0">
            <div className={`p-0.5 rounded-full ${u.hasUnseen ? 'bg-gradient-to-br from-accent to-accent3' : 'bg-white/15'}`}>
              <div className="bg-bg p-0.5 rounded-full">
                <Avatar name={u.name} color={u.color} avatar={u.avatar} size="md" />
              </div>
            </div>
            <span className="text-[11px] text-white/70 max-w-[60px] truncate">{u.name?.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
