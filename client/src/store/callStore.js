import { create } from 'zustand';

// Состояния звонка:
// 'idle'      — звонка нет
// 'outgoing'  — мы звоним, ждём ответа
// 'incoming'  — нам звонят, ждём решения пользователя
// 'active'    — соединение установлено

export const useCallStore = create((set) => ({
  status: 'idle',
  peer: null,           // { id, name, color, avatar }
  conversationId: null,
  offer: null,          // SDP offer (когда incoming)
  micEnabled: true,
  videoEnabled: true,

  startOutgoing: (peer, conversationId) =>
    set({ status: 'outgoing', peer, conversationId, offer: null, micEnabled: true, videoEnabled: true }),

  setIncoming: ({ peer, offer, conversationId }) =>
    set({ status: 'incoming', peer, offer, conversationId, micEnabled: true, videoEnabled: true }),

  setActive: () => set({ status: 'active' }),

  setMic: (micEnabled) => set({ micEnabled }),
  setVideo: (videoEnabled) => set({ videoEnabled }),

  reset: () =>
    set({ status: 'idle', peer: null, conversationId: null, offer: null, micEnabled: true, videoEnabled: true }),
}));
