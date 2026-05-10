import mongoose from '../db/mongooseShim.js';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    // 'direct' | 'group'
    kind: {
      type: String,
      default: 'direct',
    },
    title: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    // Owner of group (creator)
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageTime: Date,
    lastMessageSenderId: mongoose.Schema.Types.ObjectId,
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
