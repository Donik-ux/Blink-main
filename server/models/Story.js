import mongoose from '../db/mongooseShim.js';

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // 'image' | 'text' | 'location'
    kind: {
      type: String,
      default: 'text',
    },
    // text content или подпись к картинке
    text: {
      type: String,
      default: '',
    },
    // base64 data URL (сжимается до ~150KB)
    image: {
      type: String,
      default: null,
    },
    bgColor: {
      type: String,
      default: '#7c3aed',
    },
    // Геопозиция, если share location story
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    // Авто-удаление через 24ч
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    // userId, кто посмотрел
    viewers: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true }
);

storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Story', storySchema);
