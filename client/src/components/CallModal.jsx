import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, PhoneIncoming } from 'lucide-react';
import { useCallStore } from '../store/callStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { Avatar } from './Avatar.jsx';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// Глобальная модалка звонка. Слушает callStore и поднимает/закрывает WebRTC-сессию.
export const CallModal = () => {
  const { socket } = useSocket();
  const status = useCallStore((s) => s.status);
  const peer = useCallStore((s) => s.peer);
  const offer = useCallStore((s) => s.offer);
  const micEnabled = useCallStore((s) => s.micEnabled);
  const videoEnabled = useCallStore((s) => s.videoEnabled);
  const setActive = useCallStore((s) => s.setActive);
  const setMic = useCallStore((s) => s.setMic);
  const setVideo = useCallStore((s) => s.setVideo);
  const reset = useCallStore((s) => s.reset);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const ringtoneRef = useRef(null);

  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);

  // Таймер активного звонка
  useEffect(() => {
    if (status !== 'active') {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const cleanup = () => {
    try {
      if (pcRef.current) {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
    } catch { /* ignore */ }
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    } catch { /* ignore */ }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
  };

  const endCall = (notify = true) => {
    if (notify && socket && peer?.id) {
      socket.emit('call-end', { to: peer.id });
    }
    cleanup();
    reset();
  };

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('ice-candidate', { to: peerId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') setActive();
      if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (useCallStore.getState().status !== 'idle') endCall(false);
      }
    };

    return pc;
  };

  // Получаем медиа-устройства
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Нет доступа к камере/микрофону'
          : 'Не удалось получить доступ к устройствам'
      );
      throw err;
    }
  };

  // OUTGOING — создаём offer и отправляем
  useEffect(() => {
    if (status !== 'outgoing' || !peer?.id || !socket) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await getMedia();
        if (cancelled) return;
        const pc = createPeerConnection(peer.id);
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const o = await pc.createOffer();
        await pc.setLocalDescription(o);
        socket.emit('call-user', {
          to: peer.id,
          offer: o,
          conversationId: useCallStore.getState().conversationId,
        });
      } catch (e) {
        if (!cancelled) endCall(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, peer?.id]);

  // Слушаем ответ от callee и ICE
  useEffect(() => {
    if (!socket) return;

    const onAnswered = async ({ from, answer }) => {
      if (!pcRef.current || !peer?.id || String(from) !== String(peer.id)) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingCandidatesRef.current) {
          try { await pcRef.current.addIceCandidate(c); } catch { /* ignore */ }
        }
        pendingCandidatesRef.current = [];
      } catch (e) {
        console.warn('setRemoteDescription failed', e);
      }
    };

    const onIce = async ({ from, candidate }) => {
      if (!peer?.id || String(from) !== String(peer.id)) return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (e) {
        console.warn('addIceCandidate failed', e);
      }
    };

    const onEnded = ({ from }) => {
      if (peer?.id && String(from) === String(peer.id)) {
        cleanup();
        reset();
      }
    };

    const onRejected = ({ from }) => {
      if (peer?.id && String(from) === String(peer.id)) {
        setError('Звонок отклонён');
        setTimeout(() => { cleanup(); reset(); setError(null); }, 1200);
      }
    };

    const onCallError = (data) => {
      setError(data?.code === 'offline' ? 'Пользователь не в сети' : (data?.message || 'Ошибка звонка'));
      setTimeout(() => { cleanup(); reset(); setError(null); }, 1500);
    };

    socket.on('call-answered', onAnswered);
    socket.on('ice-candidate', onIce);
    socket.on('call-ended', onEnded);
    socket.on('call-rejected', onRejected);
    socket.on('call-error', onCallError);
    return () => {
      socket.off('call-answered', onAnswered);
      socket.off('ice-candidate', onIce);
      socket.off('call-ended', onEnded);
      socket.off('call-rejected', onRejected);
      socket.off('call-error', onCallError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, peer?.id]);

  // Принять входящий звонок
  const handleAccept = async () => {
    if (!offer || !peer?.id || !socket) return;
    try {
      const stream = await getMedia();
      const pc = createPeerConnection(peer.id);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const a = await pc.createAnswer();
      await pc.setLocalDescription(a);
      socket.emit('call-answer', { to: peer.id, answer: a });
      for (const c of pendingCandidatesRef.current) {
        try { await pc.addIceCandidate(c); } catch { /* ignore */ }
      }
      pendingCandidatesRef.current = [];
      setActive();
    } catch (e) {
      endCall(true);
    }
  };

  const handleReject = () => {
    if (socket && peer?.id) socket.emit('call-reject', { to: peer.id });
    cleanup();
    reset();
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    stream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMic(next);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !videoEnabled;
    stream.getVideoTracks().forEach((t) => { t.enabled = next; });
    setVideo(next);
  };

  // Очистка при размонтировании
  useEffect(() => () => cleanup(), []);

  if (status === 'idle') return null;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isIncoming = status === 'incoming';
  const isOutgoing = status === 'outgoing';
  const isActive = status === 'active';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col">
      {/* Видео remote — fullscreen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Затемнение поверх для читаемости */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

      {/* Локальное превью */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={`absolute top-4 right-4 w-28 h-40 rounded-2xl object-cover border border-white/20 shadow-2xl bg-black ${videoEnabled ? '' : 'opacity-40'}`}
      />

      {/* Заголовок: аватар + имя + статус */}
      <div className="relative pt-16 px-6 text-center text-white">
        {!isActive && (
          <>
            <div className="flex justify-center mb-4 animate-pulse">
              <Avatar name={peer?.name || '?'} color={peer?.color} size="xl" />
            </div>
            <h2 className="text-2xl font-bold">{peer?.name || 'Звонок'}</h2>
            <p className="text-white/60 text-sm mt-1">
              {isIncoming ? 'Видеозвонок…' : 'Соединение…'}
            </p>
          </>
        )}
        {isActive && (
          <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-online animate-pulse" />
            <span className="text-white text-sm font-semibold">{formatTime(seconds)}</span>
          </div>
        )}
        {error && (
          <p className="mt-3 inline-block text-sm bg-red-500/30 text-red-200 px-3 py-1 rounded-full">
            {error}
          </p>
        )}
      </div>

      {/* Кнопки управления */}
      <div className="relative mt-auto pb-12 px-8 safe-bottom">
        {isIncoming ? (
          <div className="flex items-center justify-center gap-10">
            <button
              onClick={handleReject}
              className="press w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_8px_32px_rgba(239,68,68,0.5)]"
              aria-label="Отклонить"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <button
              onClick={handleAccept}
              className="press w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-[0_8px_32px_rgba(16,185,129,0.5)] animate-pulse"
              aria-label="Принять"
            >
              <Phone size={26} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={toggleMic}
              className={`press w-14 h-14 rounded-full flex items-center justify-center transition ${
                micEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-black'
              }`}
              aria-label={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {micEnabled ? <Mic size={22} className="text-white" /> : <MicOff size={22} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`press w-14 h-14 rounded-full flex items-center justify-center transition ${
                videoEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-black'
              }`}
              aria-label={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {videoEnabled ? <Video size={22} className="text-white" /> : <VideoOff size={22} />}
            </button>
            <button
              onClick={() => endCall(true)}
              className="press w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_8px_32px_rgba(239,68,68,0.5)]"
              aria-label="Завершить"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
