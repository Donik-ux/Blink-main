import jwt from 'jsonwebtoken';

// Middleware для проверки JWT токена
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен отсутствует' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Refresh-токены имеют typ='refresh' и не должны проходить по REST-роутам.
    if (decoded?.typ && decoded.typ !== 'access') {
      return res.status(401).json({ error: 'Неверный тип токена' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    return res.status(401).json({ error: 'Некорректный токен' });
  }
};
