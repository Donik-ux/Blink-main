import { apiClient } from './client.js';

export const getHistory = async (params = {}) => {
  const r = await apiClient.get('/history', { params });
  return r.data;
};
export const getHeatmap = async (params = {}) => {
  const r = await apiClient.get('/history/heatmap', { params });
  return r.data;
};
