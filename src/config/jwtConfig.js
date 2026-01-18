export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  refreshTokenExpiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
};