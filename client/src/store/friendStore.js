import { create } from 'zustand';

export const useFriendStore = create((set) => ({
  friends: [],
  requests: [],
  ghostMode: false,

  setFriends: (friends) => set({ friends }),
  setRequests: (requests) => set({ requests }),

  addRequest: (request) =>
    set((state) =>
      state.requests.some((r) => r.id === request.id)
        ? state
        : { requests: [request, ...state.requests] }
    ),

  removeRequest: (requestId) =>
    set((state) => ({
      requests: state.requests.filter((r) => r.id !== requestId),
    })),

  addFriend: (friend) =>
    set((state) => ({ friends: [...state.friends, friend] })),

  removeFriend: (friendId) =>
    set((state) => ({
      friends: state.friends.filter((f) => (f.id || f._id) !== friendId),
    })),

  setGhostMode: (ghostMode) => set({ ghostMode }),

  updateFriendDistance: (friendId, distance) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        (f.id || f._id) === friendId ? { ...f, distance } : f
      ),
    })),

  updateFriendPresence: (userId, { online, lastSeen }) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        (f.id || f._id)?.toString() === userId?.toString()
          ? { ...f, online, ...(lastSeen !== undefined ? { lastSeen } : {}) }
          : f
      ),
    })),
}));
