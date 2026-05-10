import { apiClient } from './client.js';

export const getStoriesFeed = async () => (await apiClient.get('/stories')).data;
export const createStory = async (data) => (await apiClient.post('/stories', data)).data;
export const viewStory = async (id) => (await apiClient.post(`/stories/${id}/view`)).data;
export const deleteStory = async (id) => (await apiClient.delete(`/stories/${id}`)).data;
