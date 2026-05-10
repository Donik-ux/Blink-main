import mongoose from '../db/mongooseShim.js';

// Круглая зона: уведомления когда друг входит/выходит
const geofenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 50,
    },
    emoji: {
      type: String,
      default: '🏠',
    },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    // Радиус в метрах (50–2000)
    radius: { type: Number, default: 150, min: 50, max: 2000 },
    // Триггерить когда: 'enter' | 'exit' | 'both'
    trigger: { type: String, default: 'both' },
    // Notify когда друзья входят (true) или только сам пользователь (false)
    notifyForFriends: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

geofenceSchema.index({ userId: 1 });

export default mongoose.model('Geofence', geofenceSchema);
