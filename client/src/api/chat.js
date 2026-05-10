import { apiClient } from './client.js';

export const getConversations = async () => {
  const response = await apiClient.get('/chat/conversations');
  return response.data;
};

export const getMessages = async (conversationId) => {
  const response = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
  return response.data;
};

export const createConversation = async (friendId) => {
  const response = await apiClient.post('/chat/conversations', { friendId });
  return response.data;
};

export const createGroup = async (title, memberIds, avatar = null) => {
  const response = await apiClient.post('/chat/groups', { title, memberIds, avatar });
  return response.data;
};

export const sendMessage = async (conversationId, text, opts = {}) => {
  const body = {
    conversationId,
    text: text || '',
    kind: opts.kind || 'text',
    audio: opts.audio || null,
    audioDuration: opts.audioDuration || 0,
    image: opts.image || null,
    replyTo: opts.replyTo || null,
  };
  const response = await apiClient.post('/chat/messages', body);
  return response.data;
};

export const markAsRead = async (conversationId) => {
  const response = await apiClient.put(`/chat/conversations/${conversationId}/read`);
  return response.data;
};

export const reactToMessage = async (messageId, emoji) => {
  const response = await apiClient.post(`/chat/messages/${messageId}/reaction`, { emoji });
  return response.data;
};

export const editMessage = async (messageId, text) => {
  const response = await apiClient.put(`/chat/messages/${messageId}`, { text });
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await apiClient.delete(`/chat/messages/${messageId}`);
  return response.data;
};
