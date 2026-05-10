import { apiClient } from './client.js';

// GET /api/friends
export const getFriends = async () => {
  const response = await apiClient.get('/friends');
  return response.data;
};

// GET /api/friends/requests
export const getFriendRequests = async () => {
  const response = await apiClient.get('/friends/requests');
  return response.data;
};

// POST /api/friends/invite
export const inviteFriend = async (code) => {
  const response = await apiClient.post('/friends/invite', { code });
  return response.data;
};

// PUT /api/friends/:id/accept
export const acceptFriendRequest = async (friendshipId) => {
  const response = await apiClient.put(`/friends/${friendshipId}/accept`);
  return response.data;
};

// PUT /api/friends/:id/reject
export const rejectFriendRequest = async (friendshipId) => {
  const response = await apiClient.put(`/friends/${friendshipId}/reject`);
  return response.data;
};

// DELETE /api/friends/:id
export const removeFriend = async (friendId) => {
  const response = await apiClient.delete(`/friends/${friendId}`);
  return response.data;
};

// PUT /api/friends/:friendId/nickname
export const setFriendNickname = async (friendId, nickname) => {
  const response = await apiClient.put(`/friends/${friendId}/nickname`, { nickname });
  return response.data;
};
