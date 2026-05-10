import { apiClient } from './client.js';

export const getCheckins = async () => (await apiClient.get('/checkins')).data;
export const createCheckin = async (data) => (await apiClient.post('/checkins', data)).data;
