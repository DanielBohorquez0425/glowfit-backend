import prisma from "../config/prismaClient.js";

export const findAll = async (options = {}) => {
  const { limit = 20, offset = 0 } = options;

  const [gyms, total] = await Promise.all([
    prisma.gyms.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        city: true,
        country: true,
        logo_url: true,
        cover_image_url: true,
        phone: true,
        email: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.gyms.count(),
  ]);

  return { gyms, total };
};
