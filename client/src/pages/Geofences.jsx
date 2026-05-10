import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, MapPin } from 'lucide-react';
import { getGeofences, createGeofence, deleteGeofence, updateGeofence } from '../api/geofences.js';
import { useLocationStore } from '../store/locationStore.js';
import { useT } from '../i18n/index.js';

const EMOJIS = ['🏠', '💼', '🏫', '🏋️', '☕', '🍽️', '🛒', '🌳', '⛪', '📍'];

export const Geofences = () => {
  const t = useT();
  const navigate = useNavigate();
  const myLocation = useLocationStore((s) => s.myLocation);
  const [fences, setFences] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [radius, setRadius] = useState(150);

  const load = async () => {
    try { setFences(await getGeofences()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!name.trim() || !myLocation) return;
    try {
      await createGeofence({
        name: name.trim(),
        emoji,
        lat: myLocation.lat,
        lng: myLocation.lng,
        radius,
      });
      setName(''); setRadius(150); setEmoji('🏠'); setCreating(false);
      await load();
    } catch (err) {
      console.warn(err);
    }
  };

  const onDelete = async (id) => {
    if (!confirm(t('delete') + '?')) return;
    try { await deleteGeofence(id); await load(); } catch {}
  };

  const toggleActive = async (f) => {
    try {
      await updateGeofence(f._id, { active: !f.active });
      await load();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-bg pb-24 safe-top">
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="press p-2 -ml-1"><ArrowLeft size={22} className="text-accent" /></button>
          <h1 className="text-xl font-bold text-white flex-1">{t('profile_geofences')}</h1>
          <button onClick={() => setCreating(true)} className="press p-2 bg-accent rounded-xl text-black"><Plus size={20} /></button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {fences.length === 0 && !creating && (
          <div className="text-center text-white/50 py-12">
            <MapPin size={32} className="mx-auto mb-3 opacity-50" />
            <p>{t('geofence_no_zones')}</p>
            <button onClick={() => setCreating(true)} className="mt-4 bg-accent text-black rounded-full px-4 py-2 font-bold press">{t('geofence_create')}</button>
          </div>
        )}

        {creating && (
          <div className="card space-y-3 animate-fadeIn">
            <p className="text-white font-semibold">{t('geofence_create')}</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('geofence_name')} maxLength={40} />
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={`text-xl w-9 h-9 rounded-full flex items-center justify-center ${emoji === e ? 'bg-accent' : 'bg-white/5'}`}>{e}</button>
              ))}
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">{t('geofence_radius')}: {radius} м</p>
              <input type="range" min={50} max={1000} step={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            {!myLocation && <p className="text-amber-400 text-xs">Нужна геолокация — открой карту, чтобы получить координаты</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreating(false)} className="press flex-1 bg-white/5 rounded-xl py-2 text-white/80">{t('cancel')}</button>
              <button onClick={submit} disabled={!name.trim() || !myLocation} className="press flex-1 bg-accent text-black rounded-xl py-2 font-bold disabled:opacity-30">{t('save')}</button>
            </div>
          </div>
        )}

        {fences.map((f) => (
          <div key={f._id} className="card flex items-center gap-3">
            <div className="text-2xl">{f.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${f.active ? 'text-white' : 'text-white/40'}`}>{f.name}</p>
              <p className="text-white/40 text-xs">R: {f.radius} м • {f.trigger}</p>
            </div>
            <button onClick={() => toggleActive(f)} className={`text-xs font-bold rounded-full px-3 py-1 ${f.active ? 'bg-online/20 text-online' : 'bg-white/10 text-white/60'}`}>
              {f.active ? 'on' : 'off'}
            </button>
            <button onClick={() => onDelete(f._id)} className="press p-2 text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
