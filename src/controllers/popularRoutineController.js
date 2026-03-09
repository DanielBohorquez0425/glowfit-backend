import * as popularRoutineService from "../services/popularRoutineService.js";

export const getPopularRoutines = async (req, res) => {
  try {
    const { level } = req.query;
    const routines = await popularRoutineService.getPopularRoutines(level);
    res.json(routines);
  } catch (error) {
    const status = error.message.startsWith("Nivel inválido") ? 400 : 500;
    res
      .status(status)
      .json({ error: error.message || "Error al obtener las rutinas populares" });
  }
};
