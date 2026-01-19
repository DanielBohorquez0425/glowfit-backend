import prisma from "../config/prismaClient.js";

export const findAll = async (options = {}) => {
  const {
    limit,
    offset,
    muscleGroupId,
    includeRelations = false,
    link,
    difficulty,
  } = options;

  const where = {};
  if (muscleGroupId) {
    where.muscle_group_id = muscleGroupId;
  }
  if (difficulty) {
    where.difficulty = difficulty;
  }

  const include = includeRelations
    ? {
        muscle_group: true,
        exercise_muscles: {
          include: {
            muscle_group: true,
          },
        },
      }
    : undefined;

  const queryOptions = {
    where,
    include,
    orderBy: { name: "asc" },
  };

  if (limit) {
    queryOptions.take = parseInt(limit);
  }
  if (offset) {
    queryOptions.skip = parseInt(offset);
  }

  if (link) {
    queryOptions.where.link_img = link;
  }

  const [exercises, total] = await Promise.all([
    prisma.exercise.findMany(queryOptions),
    prisma.exercise.count({ where }),
  ]);

  return { exercises, total };
};

export const findById = async (id) => {
  return await prisma.exercise.findUnique({
    where: { id },
  });
};

export const create = async (data) => {
  return await prisma.exercise.create({
    data,
  });
};

export const update = async (id, data) => {
  return await prisma.exercise.update({
    where: { id },
    data,
  });
};

export const remove = async (id) => {
  return await prisma.exercise.delete({
    where: { id },
  });
};
