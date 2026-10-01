import rateLimit from "express-rate-limit";

/**
 * Rate limiting general para toda la API
 * 100 requests por 15 minutos por IP
 * Previene ataques DDoS básicos
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Demasiadas peticiones desde esta IP, intenta nuevamente en 15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting estricto para endpoints de autenticación
 * 5 intentos por 15 minutos por IP
 * Previene ataques de fuerza bruta y credential stuffing
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: "Demasiados intentos de autenticación, intenta nuevamente en 15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiting para el login con Google
 * 20 intentos por 15 minutos por IP
 * Más holgado que authLimiter: el ID token ya lo valida Google
 */
export const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Demasiados intentos de autenticación, intenta nuevamente en 15 minutos",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting crítico para endpoints que usan IA (Groq API)
 * 10 requests por hora por usuario/IP
 * CRÍTICO: Cada llamada tiene costo monetario
 * Protege presupuesto de API y previene abuso
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: "Has alcanzado el límite de generación de rutinas con IA. Intenta nuevamente en 1 hora",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Usar user ID si está autenticado, sino usar IP por defecto
  keyGenerator: (req) => {
    // Si el usuario está autenticado, usar su ID
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return undefined;
  },
});
