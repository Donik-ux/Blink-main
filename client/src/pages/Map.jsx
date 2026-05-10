import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { MapPin, Ghost, Navigation, Route, Flame, Shield, Pin, Footprints } from 'lucide-react';
import { getFriends } from '../api/friends.js';
import { createConversation } from '../api/chat.js';
import { getGeofences } from '../api/geofences.js';
import { getHistory, getHeatmap } from '../api/history.js';
import { createCheckin } from '../api/checkins.js';
import { useAuthStore } from '../store/authStore.js';
import { useLocationStore } from '../store/locationStore.js';
import { useFriendStore } from '../store/friendStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useBrowserNotifications, requestNotificationPermission } from '../hooks/useBrowserNotifications.js';
import { BottomNav } from '../components/BottomNav.jsx';
import { FriendPopup } from '../components/FriendPopup.jsx';
import { Toast } from '../components/Toast.jsx';
import { createFriendMarker, createMyMarker } from '../components/FriendPin.jsx';
import { LiveShareButton } from '../components/LiveShareButton.jsx';
import { getProfile, setPrivacyZone as setPrivacyZoneApi } from '../api/profile.js';
import { MapSkeleton } from '../components/Skeleton.jsx';
import { calculateDistance } from '../utils/geo.js';
import { useT } from '../i18n/index.js';
import { useThemeStore } from '../store/themeStore.js';
import 'leaflet/dist/leaflet.css';

const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

export const Map = () => {
  const t = useT();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const currentUser = useAuthStore((state) => state.currentUser);
  const myLocation = useLocationStore((state) => state.myLocation);
  const friendLocations = useLocationStore((state) => state.friendLocations);
  const updateFriendLocation = useLocationStore((state) => state.updateFriendLocation);
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);
  const ghostMode = useFriendStore((state) => state.ghostMode);
  const setGhostMode = useFriendStore((state) => state.setGhostMode);

  const { socket, connected } = useSocket();
  const [hasCenteredInitially, setHasCenteredInitially] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useGeolocation(socket);
  useBrowserNotifications(socket);
  useEffect(() => {
    const asked = localStorage.getItem('notif_prompted');
    if (!asked) {
      requestNotificationPermission().finally(() => localStorage.setItem('notif_prompted', '1'));
    }
  }, []);

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [mapCenter, setMapCenter] = useState([55.7558, 37.6173]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showRoute, setShowRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [showFences, setShowFences] = useState(false);
  const [fences, setFences] = useState([]);
  const [meetingInvite, setMeetingInvite] = useState(null);
  const [etaPing, setEtaPing] = useState(null); // {fromUser, lat, lng, etaMin}
  const [checkinPlace, setCheckinPlace] = useState(null);
  const [privacyZone, setPrivacyZone] = useState(null);
  const [liveShareUntil, setLiveShareUntil] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProfile().then((p) => {
      if (cancelled) return;
      setPrivacyZone(p.privacyZone || null);
      setLiveShareUntil(p.liveShareUntil || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getFriends();
        setFriends(data);
        setIsReady(true);
      } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [setFriends]);

  useEffect(() => {
    if (isReady && friends.length > 0) {
      friends.forEach((f) => {
        const friendId = f.id || f._id;
        if (f.location && f.location.lat) {
          updateFriendLocation(friendId, {
            lat: f.location.lat,
            lng: f.location.lng,
            address: f.location.address || '',
            speed: f.location.speed ?? null,
            heading: f.location.heading ?? null,
            updatedAt: f.location.updatedAt || new Date(),
          });
        }
      });
    }
  }, [isReady, friends, updateFriendLocation]);

  useEffect(() => {
    if (myLocation && !hasCenteredInitially) {
      setMapCenter([myLocation.lat, myLocation.lng]);
      setHasCenteredInitially(true);
    }
  }, [myLocation, hasCenteredInitially]);

  // Подгрузка маршрута
  useEffect(() => {
    if (!showRoute) return;
    (async () => {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const points = await getHistory({ from: start.toISOString() });
        setRoutePoints(points || []);
      } catch {}
    })();
  }, [showRoute]);

  useEffect(() => {
    if (!showHeatmap) return;
    (async () => {
      try {
        const data = await getHeatmap({ days: 7 });
        setHeatmapData(data || []);
      } catch {}
    })();
  }, [showHeatmap]);

  useEffect(() => {
    if (!showFences) return;
    (async () => {
      try {
        setFences(await getGeofences() || []);
      } catch {}
    })();
  }, [showFences]);

  // ETA / Meeting socket events
  useEffect(() => {
    if (!socket) return;
    const onMeeting = (data) => {
      setMeetingInvite(data);
      setToast({ message: `${data.fromName} ${t('map_meeting_received')}`, type: 'success' });
    };
    const onEta = (data) => {
      setEtaPing(data);
    };
    const onEtaStop = (data) => {
      setEtaPing(null);
    };
    socket.on('meeting-invite', onMeeting);
    socket.on('eta-update', onEta);
    socket.on('eta-stopped', onEtaStop);
    return () => {
      socket.off('meeting-invite', onMeeting);
      socket.off('eta-update', onEta);
      socket.off('eta-stopped', onEtaStop);
    };
  }, [socket, t]);

  const handleCenterMap = () => {
    if (myLocation) {
      setMapCenter([myLocation.lat, myLocation.lng]);
    } else {
      setToast({ message: t('error'), type: 'error' });
    }
  };

  const handleMessageFriend = async (friend) => {
    if (!friend) return;
    try {
      const conversation = await createConversation(friend.id || friend._id);
      setSelectedFriend(null);
      navigate(`/chat/${conversation._id}`, { state: { friend } });
    } catch (error) {
      setToast({ message: t('error'), type: 'error' });
    }
  };

  const handleGhostMode = () => {
    setGhostMode(!ghostMode);
    if (socket && myLocation) {
      socket.emit('update-location', {
        lat: myLocation.lat, lng: myLocation.lng, accuracy: myLocation.accuracy,
        ghostMode: !ghostMode,
      });
    }
    setToast({ message: !ghostMode ? t('map_ghost_on') : t('map_ghost_off'), type: 'ghost' });
  };

  // Meeting point: середина пути
  const handleInviteMeeting = (friend) => {
    if (!myLocation || !friend?.location) {
      setToast({ message: 'Нужны обе локации', type: 'error' });
      return;
    }
    const lat = (myLocation.lat + friend.location.lat) / 2;
    const lng = (myLocation.lng + friend.location.lng) / 2;
    if (socket) {
      socket.emit('meeting-invite', {
        recipientId: friend.id || friend._id,
        lat, lng,
        name: 'Встреча на полпути',
      });
      setToast({ message: 'Приглашение отправлено', type: 'success' });
      setSelectedFriend(null);
    }
  };

  // ETA share — простое: расстояние / 5 км/ч
  const handleShareEta = (friend) => {
    if (!myLocation || !friend?.location) return;
    const dist = calculateDistance(myLocation.lat, myLocation.lng, friend.location.lat, friend.location.lng);
    const meters = dist.unit === 'км' ? parseFloat(dist.value) * 1000 : dist.value;
    const etaMin = Math.max(1, Math.round(meters / 1000 / 5 * 60));
    if (socket) {
      socket.emit('eta-share', {
        recipientId: friend.id || friend._id,
        destLat: friend.location.lat,
        destLng: friend.location.lng,
        destName: friend.name,
        etaMinutes: etaMin,
      });
      setToast({ message: `ETA ${etaMin} мин отправлен`, type: 'success' });
      setSelectedFriend(null);
    }
  };

  const onCheckIn = async () => {
    if (!myLocation) return;
    setCheckinPlace({
      placeName: 'Здесь',
      lat: myLocation.lat,
      lng: myLocation.lng,
      note: '',
    });
  };

  const submitCheckin = async () => {
    try {
      const data = await createCheckin({
        placeName: checkinPlace.placeName,
        lat: checkinPlace.lat,
        lng: checkinPlace.lng,
        note: checkinPlace.note,
        emoji: '📍',
      });
      setToast({ message: `+${data.checkin.points} очков!`, type: 'success' });
      setCheckinPlace(null);
    } catch (e) {
      setToast({ message: e.response?.data?.error || t('error'), type: 'error' });
    }
  };

  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  if (loading) return <MapSkeleton />;

  return (
    <div className="relative w-full h-screen bg-bg overflow-hidden">
      <MapContainer center={mapCenter} zoom={13} className="w-full h-full z-10" attributionControl={false}>
        <MapController center={mapCenter} />
        <TileLayer url={tileUrl} />

        {/* Geofences */}
        {showFences && fences.map((f) => (
          <Circle
            key={f._id}
            center={[f.lat, f.lng]}
            radius={f.radius}
            pathOptions={{ color: '#00d9ff', fillColor: '#00d9ff', fillOpacity: 0.1, weight: 2, dashArray: '4 4' }}
          />
        ))}

        {/* Privacy zone — жёлтый круг (только владельцу) */}
        {privacyZone?.active && (
          <Circle
            center={[privacyZone.lat, privacyZone.lng]}
            radius={privacyZone.radius || 200}
            pathOptions={{ color: '#ffd60a', fillColor: '#ffd60a', fillOpacity: 0.08, weight: 2, dashArray: '8 6' }}
          />
        )}

        {/* Route polyline */}
        {showRoute && routePoints.length > 1 && (
          <Polyline
            positions={routePoints.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#00d9ff', weight: 4, opacity: 0.7 }}
          />
        )}

        {/* Heatmap circles (poor man's heat) */}
        {showHeatmap && heatmapData.map((h, i) => (
          <Circle
            key={i}
            center={[h.lat, h.lng]}
            radius={50}
            pathOptions={{ color: '#ff006e', fillColor: '#ff006e', fillOpacity: Math.min(0.7, h.intensity), stroke: false }}
          />
        ))}

        {/* Meeting point */}
        {meetingInvite && (
          <Marker position={[meetingInvite.lat, meetingInvite.lng]}>
            <Popup>📍 {meetingInvite.name} от {meetingInvite.fromName}</Popup>
          </Marker>
        )}

        {/* Мой маркер */}
        {myLocation && (
          <Marker position={[myLocation.lat, myLocation.lng]} icon={createMyMarker()}>
            <Popup>{t('map_my_location')}</Popup>
          </Marker>
        )}

        {/* Маркеры друзей */}
        {friends.map((friend) => {
          const friendId = friend.id || friend._id;
          const location = friendLocations.get(friendId);
          if (!location || friend.ghostMode) return null;
          return (
            <Marker
              key={friendId}
              position={[location.lat, location.lng]}
              icon={createFriendMarker(friend, friend.color)}
              eventHandlers={{
                click: () => {
                  const dist = myLocation
                    ? calculateDistance(myLocation.lat, myLocation.lng, location.lat, location.lng)
                    : null;
                  setSelectedFriend({ ...friend, location, distance: dist });
                },
              }}
            >
              <Popup>{friend.nickname || friend.name}</Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-4 z-40 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-widest uppercase drop-shadow-lg pointer-events-none">Blink</h1>
          {connected ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md text-emerald-400 px-3.5 py-1.5 rounded-xl text-xs font-bold pointer-events-none">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {t('online')}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 backdrop-blur-md text-red-500 px-3.5 py-1.5 rounded-xl text-xs font-bold pointer-events-none">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              {t('offline')}
            </div>
          )}
        </div>

        {/* Toggles row */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          <button onClick={() => setShowRoute(!showRoute)} className={`press shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border ${showRoute ? 'bg-accent text-black border-accent' : 'bg-surface/80 text-white border-white/10'}`}>
            <Route size={14} /> {t('map_show_route')}
          </button>
          <button onClick={() => setShowHeatmap(!showHeatmap)} className={`press shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border ${showHeatmap ? 'bg-accent2 text-white border-accent2' : 'bg-surface/80 text-white border-white/10'}`}>
            <Flame size={14} /> {t('map_show_heatmap')}
          </button>
          <button onClick={() => setShowFences(!showFences)} className={`press shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border ${showFences ? 'bg-accent3 text-white border-accent3' : 'bg-surface/80 text-white border-white/10'}`}>
            <Shield size={14} /> {t('profile_geofences')}
          </button>
          <button onClick={() => navigate('/steps')} className="press shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border bg-surface/80 text-white border-white/10">
            <Footprints size={14} /> {t('nav_steps')}
          </button>
          <div className="shrink-0">
            <LiveShareButton initialUntil={liveShareUntil} />
          </div>
        </div>
      </div>

      {etaPing && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-accent text-black px-4 py-2 rounded-2xl text-sm font-bold z-40 shadow-lg animate-slideUp">
          ⏱ {etaPing.name}: {etaPing.etaMinutes} мин
        </div>
      )}

      {/* Кнопки */}
      <button onClick={handleCenterMap} className="press absolute bottom-24 right-4 bg-surface/85 backdrop-blur-xl border border-white/10 text-white w-12 h-12 flex items-center justify-center rounded-2xl z-40">
        <Navigation size={20} />
      </button>

      <button onClick={onCheckIn} className="press absolute bottom-40 right-4 bg-accent text-black w-12 h-12 flex items-center justify-center rounded-2xl z-40 font-bold">
        <Pin size={20} />
      </button>

      <button onClick={handleGhostMode} className={`press absolute bottom-24 left-4 w-12 h-12 flex items-center justify-center rounded-2xl border z-40 ${ghostMode ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-surface/85 backdrop-blur-xl border-white/10 text-white'}`}>
        <Ghost size={20} className={ghostMode ? 'animate-pulse' : ''} />
      </button>

      <button
        onClick={async () => {
          if (!myLocation) return setToast({ message: 'Сначала разреши геолокацию', type: 'error' });
          if (privacyZone?.active) {
            if (!confirm('Убрать приватную зону?')) return;
            try {
              await setPrivacyZoneApi({ active: false });
              setPrivacyZone(null);
              setToast({ message: 'Приватная зона убрана', type: 'success' });
            } catch (e) { setToast({ message: 'Ошибка', type: 'error' }); }
          } else {
            try {
              const r = await setPrivacyZoneApi({ lat: myLocation.lat, lng: myLocation.lng, radius: 200, active: true });
              setPrivacyZone(r.privacyZone);
              setToast({ message: 'Зона 200м создана здесь', type: 'success' });
            } catch (e) { setToast({ message: 'Ошибка', type: 'error' }); }
          }
        }}
        title="Приватная зона"
        className={`press absolute bottom-40 left-4 w-12 h-12 flex items-center justify-center rounded-2xl border z-40 ${privacyZone?.active ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'bg-surface/85 backdrop-blur-xl border-white/10 text-white'}`}
      >
        <Shield size={20} />
      </button>

      {ghostMode && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 backdrop-blur-md text-amber-400 px-5 py-2.5 rounded-2xl text-sm font-bold z-40 flex items-center gap-2 animate-slideUp">
          <Ghost size={16} />
          <span>{t('map_ghost_on')}</span>
        </div>
      )}

      {selectedFriend && (
        <FriendPopup
          friend={selectedFriend}
          distance={selectedFriend.distance}
          onClose={() => setSelectedFriend(null)}
          onMessage={handleMessageFriend}
          onMeet={() => handleInviteMeeting(selectedFriend)}
          onEta={() => handleShareEta(selectedFriend)}
        />
      )}

      {meetingInvite && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-xl border border-accent/40 rounded-2xl p-3 z-40 shadow-lg animate-slideUp">
          <p className="text-white text-sm">{meetingInvite.fromName} {t('map_meeting_received')}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setMapCenter([meetingInvite.lat, meetingInvite.lng]); setMeetingInvite(null); }} className="press bg-accent text-black rounded-xl px-3 py-1.5 text-xs font-bold">Показать</button>
            <button onClick={() => setMeetingInvite(null)} className="press bg-white/10 text-white rounded-xl px-3 py-1.5 text-xs">{t('cancel')}</button>
          </div>
        </div>
      )}

      {checkinPlace && (
        <div className="fixed inset-x-4 bottom-32 z-50 max-w-md mx-auto bg-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 animate-slideUp">
          <p className="text-white font-bold mb-2">{t('checkin_button')}</p>
          <input value={checkinPlace.placeName} onChange={(e) => setCheckinPlace({ ...checkinPlace, placeName: e.target.value })} placeholder="Название места" maxLength={60} className="mb-2" />
          <input value={checkinPlace.note} onChange={(e) => setCheckinPlace({ ...checkinPlace, note: e.target.value })} placeholder={t('checkin_note_placeholder')} maxLength={200} className="mb-2" />
          <div className="flex gap-2">
            <button onClick={() => setCheckinPlace(null)} className="press flex-1 bg-white/10 rounded-xl py-2 text-white">{t('cancel')}</button>
            <button onClick={submitCheckin} className="press flex-1 bg-accent text-black rounded-xl py-2 font-bold">{t('save')}</button>
          </div>
        </div>
      )}

      <BottomNav />
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};
