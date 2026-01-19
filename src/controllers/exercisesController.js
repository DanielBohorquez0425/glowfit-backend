import * as exerciseService from "../services/exerciseService.js";

export const getExercises = async (req, res) => {
  try {
    const { limit, page, muscleGroupId, includeRelations, link, difficulty } = req.query;

    const parsedLimit = limit ? parseInt(limit) : 10;
    const parsedPage = page ? parseInt(page) : 1;
    const offset = (parsedPage - 1) * parsedLimit;

    const options = {
      limit: parsedLimit,
      offset: offset,
      muscleGroupId,
      includeRelations: includeRelations === "true",
      link,
      difficulty,
    };

    const result = await exerciseService.getExercises(options);
    const totalPages = Math.ceil(result.total / parsedLimit);

    res.json({
      pagination: {
        total: result.total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1,
      },
      data: result.exercises,
    });
  } catch (error) {
    console.error("Error fetching exercises:", error);
    res.status(500).json({ error: "Error al obtener ejercicios" });
  }
};

export const getExerciseById = async (req, res) => {
  try {
    const exercise = await exerciseService.getExerciseById(req.params.id);
    if (!exercise) {
      return res.status(404).json({ error: "Ejercicio no encontrado" });
    }
    res.json(exercise);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ejercicio" });
  }
};

export const createExercise = async (req, res) => {
  try {
    const exercise = await exerciseService.createExercise(req.body);
    res.json(exercise);
  } catch (error) {
    res.status(500).json({ error: "Error al crear ejercicio" });
  }
};

export const updateExercise = async (req, res) => {
  try {
    const exercise = await exerciseService.updateExercise(
      req.params.id,
      req.body
    );
    res.json(exercise);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar ejercicio" });
  }
};

export const deleteExercise = async (req, res) => {
  try {
    const exercise = await exerciseService.deleteExercise(req.params.id);
    res.json(exercise);
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar ejercicio" });
  }
};
