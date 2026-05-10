import mongoose from '../db/mongooseShim.js';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    // 'text' | 'voice' | 'image' | 'system'
    kind: {
      type: String,
      default: 'text',
    },
    // base64 data URL для голосовых сообщений
    audio: {
      type: String,
      default: null,
    },
    audioDuration: {
      type: Number,
      default: 0,
    },
    // base64 data URL для image-сообщений (сжимается на клиенте до ~150KB)
    image: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // userId -> ISO timestamp когда увидел
    seenBy: {
      type: Map,
      of: String,
      default: {},
    },
    // userId -> emoji
    reactions: {
      type: Map,
      of: String,
      default: {},
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

export default mongoose.model('Message', messageSchema);
