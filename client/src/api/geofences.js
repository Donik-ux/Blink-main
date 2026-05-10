import { apiClient } from './client.js';

export const getGeofences = async () => (await apiClient.get('/geofences')).data;
export const createGeofence = async (data) => (await apiClient.post('/geofences', data)).data;
export const updateGeofence = async (id, data) => (await apiClient.put(`/geofences/${id}`, data)).data;
export const deleteGeofence = async (id) => (await apiClient.delete(`/geofences/${id}`)).data;
