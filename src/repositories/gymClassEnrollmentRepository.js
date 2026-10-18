import prisma from "../config/prismaClient.js";

/**
 * Inscribe a un usuario en una clase de forma atómica.
 * El UPDATE condicional reserva el cupo sin condiciones de carrera; si el
 * insert falla (ya inscrito), la transacción revierte el incremento.
 *
 * @throws {Error} CLASS_FULL | ALREADY_ENROLLED
 */
export const enrollUser = async (classId, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE gym_classes
        SET enrolled = enrolled + 1
        WHERE id = ${classId}::uuid AND enrolled < capacity`;

      if (updated === 0) throw new Error("CLASS_FULL");

      return await tx.gym_class_enrollments.create({
        data: { class_id: classId, user_id: userId },
      });
    });
  } catch (error) {
    if (error.code === "P2002") throw new Error("ALREADY_ENROLLED");
    throw error;
  }
};

/**
 * Cancela la inscripción y libera el cupo de forma atómica.
 *
 * @throws {Error} NOT_ENROLLED
 */
export const cancelEnrollment = async (classId, userId) => {
  return await prisma.$transaction(async (tx) => {
    const { count } = await tx.gym_class_enrollments.deleteMany({
      where: { class_id: classId, user_id: userId },
    });

    if (count === 0) throw new Error("NOT_ENROLLED");

    await tx.$executeRaw`
      UPDATE gym_classes
      SET enrolled = enrolled - 1
      WHERE id = ${classId}::uuid AND enrolled > 0`;
  });
};

export const listEnrollments = async (classId) => {
  return await prisma.gym_class_enrollments.findMany({
    where: { class_id: classId },
    select: {
      id: true,
      user_id: true,
      created_at: true,
      user: {
        select: { id: true, name: true, last_name: true, email: true },
      },
    },
    orderBy: { created_at: "asc" },
  });
};

/**
 * Devuelve los ids de clase (de la lista dada) en los que el usuario está inscrito.
 */
export const findEnrolledClassIds = async (userId, classIds) => {
  if (classIds.length === 0) return [];

  const rows = await prisma.gym_class_enrollments.findMany({
    where: { user_id: userId, class_id: { in: classIds } },
    select: { class_id: true },
  });

  return rows.map((row) => row.class_id);
};
