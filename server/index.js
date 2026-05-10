import dotenv from 'dotenv';
dotenv.config();

console.log('📝 MONGODB_URI:', process.env.MONGODB_URI ? 'Загружена ✓' : 'НЕ ЗАГРУЖЕНА ✗');
console.log('PORT:', process.env.PORT || '5000 (по умолчанию)');

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import { gzipMiddleware } from './middleware/gzip.js';

// Импорт роутов
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import profileRoutes from './routes/profile.js';
import notificationsRoutes from './routes/notifications.js';
import savedLocationsRoutes from './routes/savedLocations.js';
import messagesRoutes from './routes/messages.js';
import stepsRoutes from './routes/steps.js';
import storiesRoutes from './routes/stories.js';
import geofencesRoutes from './routes/geofences.js';
import historyRoutes from './routes/history.js';
import checkinsRoutes from './routes/checkins.js';
import badgesRoutes from './routes/badges.js';
import pushRoutes from './routes/push.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('✗ JWT_SECRET обязателен в production');
  process.exit(1);
}

const START_TIME = Date.now();
const app = express();
const httpServer = createServer(app);

// В production ограничиваем CORS до CLIENT_URL (если задан), иначе разрешаем любые источники.
const corsOrigin =
  process.env.NODE_ENV === 'production' && process.env.CLIENT_URL
    ? process.env.CLIENT_URL
    : true;

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(gzipMiddleware);
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use('/api', apiLimiter);

// JSON-ошибки
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Некорректный JSON' });
  }
  next();
});

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/saved-locations', savedLocationsRoutes);
app.use('/api/chat', messagesRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/geofences', geofencesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/push', pushRoutes);

// Расширенный health
app.get('/health', (req, res) => {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  res.json({
    status: 'ok',
    uptime: uptimeSec,
    clients: io.sockets.sockets.size,
    nodeEnv: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

app.set('io', io);
setupSocketHandlers(io);

// Запуск
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    const PORT = process.env.PORT || 5000;
    
    httpServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`\n✗ Ошибка: Порт ${PORT} уже занят. Закрой другие терминалы или используй 'taskkill /F /IM node.exe'`);
        process.exit(1);
      }
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ Сервер Blink запущен на http://localhost:${PORT}`);
      console.log(`✓ Socket.io готов на ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

// Graceful shutdown — даём активным запросам завершиться
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n⏳ Получен ${signal}, завершаю работу...`);

  // Перестаём принимать новые соединения
  httpServer.close(() => {
    console.log('✓ HTTP-сервер закрыт');
    process.exit(0);
  });

  // Закрываем все сокеты
  io.close(() => {
    console.log('✓ Socket.io закрыт');
  });

  // Жёсткий выход если за 10с не успели
  setTimeout(() => {
    console.warn('⚠ Принудительный выход через 10с');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
