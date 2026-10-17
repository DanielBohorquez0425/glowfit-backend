import * as exerciseService from "../services/exerciseService.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getExercises = async (req, res) => {
  try {
    const { limit, cursor, muscleGroupId, includeRelations, link, difficulty } = req.query;

    const parsedLimit = limit === undefined ? DEFAULT_LIMIT : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ error: "limit debe ser un entero positivo" });
    }
    if (cursor !== undefined && !UUID_REGEX.test(cursor)) {
      return res.status(400).json({ error: "cursor inválido" });
    }

    const result = await exerciseService.getExercisesPage({
      limit: Math.min(parsedLimit, MAX_LIMIT),
      cursor,
      muscleGroupId,
      includeRelations: includeRelations === "true",
      link,
      difficulty,
    });

    res.json(result);
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
