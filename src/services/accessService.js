import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";

/**
 * Verifica que `actorId` pueda leer o gestionar los datos de `targetUserId`.
 *
 * Pasa si el actor es:
 *   - el propio usuario,
 *   - el entrenador asignado del usuario (`trainer_id`),
 *   - un GYM_ADMIN del mismo gimnasio.
 *
 * El rol activo es el permiso: un entrenador que cambió a modo MEMBER está
 * entrenando, no gestionando, y por eso pierde el acceso.
 *
 * @param {string} actorId - Usuario autenticado que hace la petición
 * @param {string} targetUserId - Usuario cuyos datos se quieren acceder
 * @throws {Error} FORBIDDEN
 */
export const assertCanAccessUserData = async (actorId, targetUserId) => {
  if (actorId === targetUserId) return;

  const [actorMembership, targetMembership] = await Promise.all([
    gymMembershipRepository.findMembershipByUserId(actorId),
    gymMembershipRepository.findMembershipByUserId(targetUserId),
  ]);

  if (!actorMembership || !targetMembership) throw new Error("FORBIDDEN");
  if (actorMembership.gym_id !== targetMembership.gym_id) {
    throw new Error("FORBIDDEN");
  }

  if (actorMembership.active_role === "GYM_ADMIN") return;
  if (
    actorMembership.active_role === "TRAINER" &&
    targetMembership.trainer_id === actorId
  ) {
    return;
  }

  throw new Error("FORBIDDEN");
};
