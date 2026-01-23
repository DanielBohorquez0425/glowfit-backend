import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwtConfig.js';

export const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    JWT_CONFIG.secret,
    { expiresIn: JWT_CONFIG.accessTokenExpiresIn }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.secret);
  } catch (error) {
    return null;
  }
};

// Mantener compatibilidad con código existente
export const generateToken = generateAccessToken;
