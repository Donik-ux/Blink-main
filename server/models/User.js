import mongoose from '../db/mongooseShim.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Имя обязательно'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email обязателен'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Некорректный email'],
    },
    // Не required: для аккаунтов через Google пароль может отсутствовать.
    passwordHash: {
      type: String,
      default: null,
    },
    // Google sign-in
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    emailVerifyExpires: { type: Date, default: null },
    // Password reset
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    // Список заблокированных пользователей
    blocked: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    // Жалобы
    reportsReceived: {
      type: [
        {
          fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          reason: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // Live location share — друзьям до timestamp
    liveShareUntil: { type: Date, default: null },
    // Privacy zone (скрыть точную координату когда внутри радиуса)
    privacyZone: {
      type: {
        lat: Number,
        lng: Number,
        radius: { type: Number, default: 200 },
        active: { type: Boolean, default: false },
      },
      default: null,
    },
    color: {
      type: String,
      default: '#7c3aed',
    },
    avatar: {
      type: String,
      default: null,
    },
    inviteCode: {
      type: String,
      unique: true,
      required: true,
    },
    ghostMode: {
      type: Boolean,
      default: false,
    },
    privacyMode: {
      type: String,
      enum: ['friends', 'everyone'],
      default: 'friends',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // Mood / status
    mood: {
      type: String,
      default: '',
    },
    moodEmoji: {
      type: String,
      default: '',
    },
    // Language preference
    locale: {
      type: String,
      default: 'ru',
    },
    // Theme preference
    theme: {
      type: String,
      default: 'dark',
    },
    // Web push subscriptions (array of PushSubscription objects)
    pushSubscriptions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Total points (gamification)
    points: {
      type: Number,
      default: 0,
    },
    // Total km walked (rough)
    totalDistance: {
      type: Number,
      default: 0,
    },
    // Unlocked badge ids
    badges: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
