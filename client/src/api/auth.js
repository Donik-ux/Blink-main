import { apiClient } from './client.js';

export const register = async (name, email, password, confirmPassword) => {
  const response = await apiClient.post('/auth/register', {
    name,
    email,
    password,
    confirmPassword,
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

export const refresh = async (refreshToken) => {
  const response = await apiClient.post('/auth/refresh', { refreshToken });
  return response.data;
};

export const logout = async () => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await apiClient.post('/auth/forgot', { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await apiClient.post('/auth/reset', { token, password });
  return response.data;
};

export const sendVerifyEmail = async () => {
  const response = await apiClient.post('/auth/send-verify');
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await apiClient.post('/auth/verify-email', { token });
  return response.data;
};

export const googleLogin = async (credential) => {
  const response = await apiClient.post('/auth/google', { credential });
  return response.data;
};
