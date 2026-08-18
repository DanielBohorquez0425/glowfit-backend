import * as gymService from "../services/gymService.js";

// Roles válidos para el filtro
const VALID_GYM_ROLES = ["GYM_ADMIN", "TRAINER", "MEMBER"];

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
 * Protegido: solo GYM_ADMIN del gym puede acceder.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - role (opcional, filtra por GymRole: GYM_ADMIN, TRAINER, MEMBER)
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

/**
 * GET /gyms/:gymId/trainer/members
 *
 * Lista los miembros del gym asignados al entrenador autenticado.
 * Protegido: solo TRAINER (rol activo) del gym puede acceder.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 */
export const listTrainerMembers = async (req, res) => {
  try {
    const { gymId } = req.params;
    const trainerId = req.user.userId;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { users, total } = await gymService.listTrainerMembers(gymId, trainerId, {
      limit,
      offset,
    });
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
    console.error("Error al obtener los miembros asignados:", error);
    res.status(500).json({ error: "Error interno al obtener los miembros asignados." });
  }
};

/**
 * PATCH /gyms/:gymId/members/:userId/roles
 *
 * Agrega y/o quita roles de gym a un miembro.
 * Protegido: solo GYM_ADMIN del gym puede acceder.
 *
 * Body:
 *   { "add": ["TRAINER"], "remove": ["MEMBER"] }  // ambos opcionales, al menos uno
 */
export const updateMemberRoles = async (req, res) => {
  try {
    const { gymId, userId } = req.params;
    const { add, remove } = req.body;

    if (add !== undefined && !Array.isArray(add)) {
      return res.status(400).json({ error: "'add' debe ser un array de roles" });
    }
    if (remove !== undefined && !Array.isArray(remove)) {
      return res.status(400).json({ error: "'remove' debe ser un array de roles" });
    }
    if ((!add || add.length === 0) && (!remove || remove.length === 0)) {
      return res.status(400).json({
        error: "Debes especificar al menos un rol en 'add' o 'remove'",
      });
    }

    const membership = await gymService.updateMemberRoles(gymId, userId, { add, remove });

    res.json({
      success: true,
      data: {
        membership_id: membership.id,
        active_role: membership.active_role,
        gym_roles: membership.gym_roles,
      },
    });
  } catch (error) {
    if (error.message === "INVALID_ROLE") {
      return res.status(400).json({
        error: `Rol inválido. Valores permitidos: ${VALID_GYM_ROLES.join(", ")}`,
      });
    }
    if (error.message === "MEMBERSHIP_NOT_FOUND") {
      return res.status(404).json({ error: "El usuario no pertenece a este gimnasio." });
    }
    if (error.message === "CANNOT_REMOVE_LAST_ROLE") {
      return res.status(400).json({ error: "No se puede dejar al miembro sin roles." });
    }
    console.error("Error al actualizar roles del miembro:", error);
    res.status(500).json({ error: "Error interno al actualizar los roles del miembro." });
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
