import { verifyToken } from '../utils/jwtUtils.js';
import { findTokenVersionById, findRoleById } from '../repositories/userRepository.js';
import { findMembershipByUserId } from '../repositories/gymMembershipRepository.js';

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

/**
 * Middleware de autorización por rol de gym.
 * DEBE usarse DESPUÉS de authenticateToken.
 *
 * Verifica que:
 * 1. El usuario pertenezca al gym indicado en req.params.gymId
 * 2. Su active_role esté dentro de los roles permitidos
 *
 * @param  {...string} allowedRoles - Roles permitidos (ej: 'GYM_ADMIN', 'TRAINER')
 * @returns {Function} Express middleware
 *
 * Uso:
 *   router.get("/:gymId/users", authenticateToken, requireGymRole("GYM_ADMIN"), handler);
 */
export const requireGymRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { gymId } = req.params;
      const userId = req.user.userId;

      if (!gymId) {
        return res.status(400).json({ error: "gymId es requerido en la ruta" });
      }

      const membership = await findMembershipByUserId(userId);

      if (!membership || membership.gym_id !== gymId) {
        return res.status(403).json({
          error: "No perteneces a este gimnasio",
        });
      }

      if (!allowedRoles.includes(membership.active_role)) {
        return res.status(403).json({
          error: `No tienes permisos. Se requiere uno de estos roles: ${allowedRoles.join(", ")}`,
        });
      }

      // Adjuntar la membresía al request para uso posterior en controllers
      req.gymMembership = membership;
      next();
    } catch (error) {
      console.error("Error en requireGymRole:", error);
      res.status(500).json({ error: "Error interno de autorización" });
    }
  };
};

/**
 * Middleware de autorización por rol GLOBAL del usuario (UserGlobalRole).
 * DEBE usarse DESPUÉS de authenticateToken.
 *
 * Lee el rol fresco desde la DB con req.user.userId y verifica que
 * esté dentro de los roles permitidos.
 *
 * @param  {...string} allowedRoles - Roles permitidos (ej: 'ADMIN', 'SUPERADMIN')
 * @returns {Function} Express middleware
 *
 * Uso:
 *   router.post("/send", authenticateToken, requireGlobalRole("ADMIN", "SUPERADMIN"), handler);
 */
export const requireGlobalRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const role = await findRoleById(req.user.userId);

      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
          error: `No tienes permisos. Se requiere uno de estos roles: ${allowedRoles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      console.error("Error en requireGlobalRole:", error);
      res.status(500).json({ error: "Error interno de autorización" });
    }
  };
};
