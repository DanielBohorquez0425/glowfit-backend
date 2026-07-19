import * as gymService from "../services/gymService.js";

// Roles válidos para el filtro
const VALID_GYM_ROLES = ["GYM_OWNER", "GYM_ADMIN", "TRAINER", "MEMBER"];

export const listAllGyms = async (req, res) => {
  // TODO: Restringir este endpoint a SUPERADMIN
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { gyms, total } = await gymService.listAllGyms({ limit, offset });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: gyms,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error al obtener gyms:", error);
    res.status(500).json({ error: "Error interno al obtener los gimnasios." });
  }
};

/**
 * GET /gyms/:gymId/users
 *
 * Lista los usuarios pertenecientes a un gym.
 * Protegido: solo GYM_OWNER y GYM_ADMIN del gym pueden acceder.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - role (opcional, filtra por GymRole: GYM_OWNER, GYM_ADMIN, TRAINER, MEMBER)
 */
export const listGymUsers = async (req, res) => {
  try {
    const { gymId } = req.params;

    // Paginación
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Filtro por rol (opcional)
    const { role } = req.query;
    if (role && !VALID_GYM_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Rol inválido. Valores permitidos: ${VALID_GYM_ROLES.join(", ")}`,
      });
    }

    const options = { limit, offset };
    if (role) options.role = role;

    const { users, total } = await gymService.listGymUsers(gymId, options);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error al obtener usuarios del gym:", error);
    res.status(500).json({ error: "Error interno al obtener los usuarios del gimnasio." });
  }
};

export const getNewMembersStats = async (req, res) => {
  try {
    const { gymId } = req.params;
    const stats = await gymService.getNewMembersStats(gymId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error al obtener estadísticas de nuevos miembros:", error);
    res.status(500).json({ error: "Error interno al obtener estadísticas de miembros." });
  }
};
