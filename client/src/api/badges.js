import { apiClient } from './client.js';

export const getBadges = async () => (await apiClient.get('/badges')).data;
export const checkBadges = async () => (await apiClient.post('/badges/check')).data;
