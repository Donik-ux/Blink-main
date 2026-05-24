import { apiClient } from './client.js';

export const syncSteps = (count, date) =>
  apiClient.post('/steps', { count, date }).then((r) => r.data);

export const getLeaderboard = () =>
  apiClient.get('/steps/leaderboard').then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.leaderboard)) return d.leaderboard;
    return [];
  });
