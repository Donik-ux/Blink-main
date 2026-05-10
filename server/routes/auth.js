import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateInviteCode, generateRandomColor } from '../utils/helpers.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { sendMail, passwordResetEmail, emailVerifyEmail } from '../utils/mailer.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

const getRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + ':refresh';

const signAccess = (userId) =>
  jwt.sign({ id: userId, typ: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });

const signRefresh = (userId) =>
  jwt.sign({ id: userId, typ: 'refresh' }, getRefreshSecret(), { expiresIn: REFRESH_TTL });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  color: user.color,
  avatar: user.avatar,
  inviteCode: user.inviteCode,
  ghostMode: user.ghostMode,
  privacyMode: user.privacyMode,
  emailVerified: !!user.emailVerified,
  hasPassword: !!user.passwordHash,
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть от 6 до 128 символов' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email уже зарегистрирован' });
    }

    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    let inviteCode;
    let unique = false;
    while (!unique) {
      inviteCode = generateInviteCode();
      const existing = await User.findOne({ inviteCode });
      if (!existing) unique = true;
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      color: generateRandomColor(),
      inviteCode,
    });

    res.status(201).json({
      token: signAccess(user._id),
      refreshToken: signRefresh(user._id),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Некорректные учётные данные' });
    }

    const ok = await bcryptjs.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Некорректные учётные данные' });
    }

    user.lastSeen = new Date();
    await user.save();

    res.json({
      token: signAccess(user._id),
      refreshToken: signRefresh(user._id),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/refresh — обменять refresh token на новый access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken обязателен' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch {
      return res.status(401).json({ error: 'Refresh токен недействителен' });
    }

    if (decoded.typ !== 'refresh') {
      return res.status(401).json({ error: 'Неверный тип токена' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json({
      token: signAccess(user._id),
      refreshToken: signRefresh(user._id), // rotation — старый тоже можно было бы инвалидировать через БД
    });
  } catch (error) {
    console.error('Ошибка refresh:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Успешно вышли' });
});

// ---------- Password reset ----------

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

// POST /api/auth/forgot — пользователь запрашивает сброс пароля
router.post('/forgot', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email обязателен' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    // Намеренно не палим, существует ли email (анти-enumeration)
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 час
      await user.save();

      const link = `${CLIENT_URL()}/reset-password?token=${token}`;
      try {
        await sendMail({ to: user.email, ...passwordResetEmail(user.name, link) });
      } catch (e) {
        console.error('Ошибка отправки письма сброса:', e.message);
      }
    }
    res.json({ message: 'Если email зарегистрирован — на него отправлено письмо' });
  } catch (error) {
    console.error('Ошибка forgot:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/reset — пользователь устанавливает новый пароль по токену
router.post('/reset', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Токен и пароль (6–128 символов) обязательны' });
    }
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ error: 'Токен недействителен или истёк' });
    }
    const salt = await bcryptjs.genSalt(10);
    user.passwordHash = await bcryptjs.hash(password, salt);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    res.json({ message: 'Пароль обновлён' });
  } catch (error) {
    console.error('Ошибка reset:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Email verification ----------

// POST /api/auth/send-verify — отправить письмо подтверждения (пользователь должен быть авторизован)
router.post('/send-verify', authLimiter, async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
    let decoded;
    try { decoded = jwt.verify(auth.substring(7), process.env.JWT_SECRET); } catch { return res.status(401).json({ error: 'Некорректный токен' }); }
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.emailVerified) return res.json({ message: 'Уже подтверждён' });

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerifyToken = crypto.createHash('sha256').update(token).digest('hex');
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    const link = `${CLIENT_URL()}/verify-email?token=${token}`;
    try {
      await sendMail({ to: user.email, ...emailVerifyEmail(user.name, link) });
    } catch (e) {
      console.error('Ошибка отправки письма подтверждения:', e.message);
    }
    res.json({ message: 'Письмо отправлено' });
  } catch (error) {
    console.error('Ошибка send-verify:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/verify-email — подтвердить email по токену
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Токен обязателен' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerifyToken: hashed,
      emailVerifyExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'Токен недействителен или истёк' });
    user.emailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpires = null;
    await user.save();
    res.json({ message: 'Email подтверждён' });
  } catch (error) {
    console.error('Ошибка verify-email:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- Google OAuth ----------

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// POST /api/auth/google — клиент шлёт Google ID-токен, мы создаём/логиним
router.post('/google', authLimiter, async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(503).json({ error: 'Google вход не настроен на сервере (GOOGLE_CLIENT_ID)' });
    }
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'credential обязателен' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: 'Email не получен от Google' });

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ $or: [{ email }, { googleId: payload.sub }] });

    if (!user) {
      let inviteCode;
      let unique = false;
      while (!unique) {
        inviteCode = generateInviteCode();
        if (!(await User.findOne({ inviteCode }))) unique = true;
      }
      user = await User.create({
        name: (payload.name || email.split('@')[0]).slice(0, 50),
        email,
        passwordHash: null,
        googleId: payload.sub,
        avatar: payload.picture || null,
        color: generateRandomColor(),
        inviteCode,
        emailVerified: !!payload.email_verified,
      });
    } else {
      let dirty = false;
      if (!user.googleId) { user.googleId = payload.sub; dirty = true; }
      if (payload.email_verified && !user.emailVerified) { user.emailVerified = true; dirty = true; }
      if (dirty) await user.save();
    }

    res.json({
      token: signAccess(user._id),
      refreshToken: signRefresh(user._id),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Ошибка google login:', error);
    res.status(401).json({ error: 'Не удалось проверить Google токен' });
  }
});

export default router;
