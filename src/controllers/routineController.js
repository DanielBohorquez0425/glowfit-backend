import * as routineService from "../services/routineService.js";
import * as aiService from "../services/aiService.js";
import * as userService from "../services/userService.js";
import * as exerciseService from "../services/exerciseService.js";

export const createRoutine = async (req, res) => {
  try {
    const userId = req.user.userId;

    const routineData = {
      ...req.body,
      user_id: userId,
    };

    const routine = await routineService.createRoutine(routineData);
    res.status(201).json(routine);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Error al crear la rutina" });
  }
};

export const getRoutinesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const routines = await routineService.getRoutinesByUserId(userId);
    res.json(routines);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Error al obtener las rutinas" });
  }
};

export const generateAIRoutine = async (req, res) => {
  try {
    const userId = req.user.userId;

    const userProfile = await userService.getUserById(userId);
    if (!userProfile) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const { exercises } = await exerciseService.getExercises();
    if (!exercises || exercises.length === 0) {
      return res.status(400).json({ error: "No hay ejercicios disponibles" });
    }

    // Generar rutinas con IA (ahora devuelve múltiples rutinas)
    const aiResponse = await aiService.generateRoutineWithAI(
      userProfile,
      exercises,
    );

    // Procesar y guardar cada rutina individualmente
    const savedRoutines = [];

    for (const aiRoutine of aiResponse.routines) {
      const routineData = {
        name: aiRoutine.name,
        description: aiRoutine.description,
        estimated_duration: aiRoutine.estimated_duration,
        level: aiRoutine.level,
        goal: aiRoutine.goal,
        user_id: userId,
        is_active: true,
        days: [aiRoutine.day],
        exercises: aiRoutine.exercises,
      };

      const savedRoutine = await routineService.createRoutine(routineData);
      savedRoutines.push(savedRoutine);
    }

    res.status(201).json({
      message: `${savedRoutines.length} rutina(s) generada(s) exitosamente con IA`,
      routines: savedRoutines,
      count: savedRoutines.length,
    });
  } catch (error) {
    console.error("Error al generar rutina con IA:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al generar rutina con IA" });
  }
};

export const markRoutineAsCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const routine = await routineService.markRoutineAsCompleted(id, userId);
    res.json({
      message: "Rutina completada exitosamente",
      routine,
    });
  } catch (error) {
    console.error("Error al completar la rutina:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al completar la rutina" });
  }
};

export const updateRoutine = async (req, res) => {
  try {
    const { id } = req.params;
    const routine = await routineService.updateRoutine(id, req.body);
    res.json(routine);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Error al actualizar la rutina" });
  }
};
