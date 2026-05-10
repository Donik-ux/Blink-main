import { apiClient } from './client.js';

export const getPushKey = async () => (await apiClient.get('/push/key')).data;
export const subscribePush = async (subscription) =>
  (await apiClient.post('/push/subscribe', { subscription })).data;
export const unsubscribePush = async (endpoint) =>
  (await apiClient.post('/push/unsubscribe', { endpoint })).data;
export const testPush = async () => (await apiClient.post('/push/test')).data;
