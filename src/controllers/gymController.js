import * as gymService from "../services/gymService.js";

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
