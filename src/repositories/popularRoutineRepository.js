import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getPopularRoutines = async (level) => {
  const where = level ? { level } : {};

  return await prisma.popular_routines.findMany({
    where,
    include: {
      popular_routine_exercises: {
        orderBy: { order_position: "asc" },
        include: {
          exercises: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
};
