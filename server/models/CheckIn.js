import mongoose from '../db/mongooseShim.js';

const checkInSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Если check-in связан с saved location
    placeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    placeName: { type: String, required: true },
    emoji: { type: String, default: '📍' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    note: { type: String, default: '', maxlength: 200 },
    points: { type: Number, default: 10 },
  },
  { timestamps: true }
);

checkInSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('CheckIn', checkInSchema);
