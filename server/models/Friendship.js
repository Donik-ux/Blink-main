import mongoose from '../db/mongooseShim.js';

const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
    },
    // Псевдонимы: userId -> custom alias
    // Каждый из друзей может видеть другого под своим псевдонимом.
    nicknames: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model('Friendship', friendshipSchema);
