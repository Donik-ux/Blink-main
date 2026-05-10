import { apiClient } from './client.js';

// GET /api/profile
export const getProfile = async () => {
  const response = await apiClient.get('/profile');
  return response.data;
};

// PUT /api/profile
export const updateProfile = async (data) => {
  const response = await apiClient.put('/profile', data);
  return response.data;
};

export const getBlockedUsers = async () =>
  (await apiClient.get('/profile/blocked')).data;

export const blockUser = async (userId) =>
  (await apiClient.post(`/profile/block/${userId}`)).data;

export const unblockUser = async (userId) =>
  (await apiClient.delete(`/profile/block/${userId}`)).data;

export const reportUser = async (userId, reason) =>
  (await apiClient.post(`/profile/report/${userId}`, { reason })).data;

export const deleteAccount = async (password) =>
  (await apiClient.delete('/profile', { data: { password } })).data;

export const setPrivacyZone = async ({ lat, lng, radius, active }) =>
  (await apiClient.put('/profile/privacy-zone', { lat, lng, radius, active })).data;

export const setLiveShare = async (minutes) =>
  (await apiClient.put('/profile/live-share', { minutes })).data;
