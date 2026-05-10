import mongoose from '../db/mongooseShim.js';

// Time-series: одна точка маршрута пользователя.
// Хранится 7 дней (TTL).
const locationHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    // ts вместо createdAt для удобства запросов
    ts: { type: Date, default: Date.now },
    // Auto-cleanup
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: false }
);

locationHistorySchema.index({ userId: 1, ts: -1 });
locationHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('LocationHistory', locationHistorySchema);
