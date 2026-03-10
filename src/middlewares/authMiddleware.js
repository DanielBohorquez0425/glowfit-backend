import { verifyToken } from '../utils/jwtUtils.js';
import { findTokenVersionById } from '../repositories/userRepository.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const currentTokenVersion = await findTokenVersionById(decoded.userId);

  if (currentTokenVersion === undefined || decoded.tokenVersion !== currentTokenVersion) {
    return res.status(401).json({ error: 'Sesión inválida. Inicia sesión nuevamente.' });
  }

  req.user = decoded;
  next();
};
