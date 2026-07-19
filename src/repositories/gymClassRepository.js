import prisma from "../config/prismaClient.js";

const CLASS_SELECT = {
  id: true,
  gym_id: true,
  instructor_id: true,
  activity: true,
  name: true,
  class_date: true,
  start_minutes: true,
  duration_minutes: true,
  room: true,
  capacity: true,
  enrolled: true,
  color: true,
  created_at: true,
  updated_at: true,
  instructor: {
    select: {
      id: true,
      name: true,
      last_name: true,
    },
  },
};

export const findByGymAndRange = async (gymId, from, to) => {
  return await prisma.gym_classes.findMany({
    where: {
      gym_id: gymId,
      class_date: { gte: from, lte: to },
    },
    select: CLASS_SELECT,
    orderBy: [{ class_date: "asc" }, { start_minutes: "asc" }],
  });
};

export const findById = async (id) => {
  return await prisma.gym_classes.findUnique({
    where: { id },
    select: CLASS_SELECT,
  });
};

export const create = async (data) => {
  return await prisma.gym_classes.create({
    data,
    select: CLASS_SELECT,
  });
};

export const update = async (id, data) => {
  return await prisma.gym_classes.update({
    where: { id },
    data,
    select: CLASS_SELECT,
  });
};

export const remove = async (id) => {
  return await prisma.gym_classes.delete({ where: { id } });
};
