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

export const getRoutineById = async (req, res) => {
  try {
    const { id } = req.params;
    const routine = await routineService.getRoutineById(id);
    res.json(routine);
  } catch (error) {
    const status = error.message === "Rutina no encontrada" ? 404 : 500;
    res
      .status(status)
      .json({ error: error.message || "Error al obtener la rutina" });
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

export const getPredefinedRoutines = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Obtener el perfil del usuario para conocer su nivel
    const userProfile = await userService.getUserById(userId);
    if (!userProfile) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Determinar el nivel del usuario (por defecto 'beginner')
    const userLevel = userProfile.level || 1;
    let difficulty;

    if (userLevel >= 1 && userLevel <= 10) {
      difficulty = 'beginner';
    } else if (userLevel >= 11 && userLevel <= 25) {
      difficulty = 'intermediate';
    } else {
      difficulty = 'advanced';
    }

    const exercises = await exerciseService.getExercises();

    if (!exercises || !exercises.exercises || exercises.exercises.length === 0) {
      return res.status(400).json({
        error: "No hay ejercicios disponibles para crear rutinas predefinidas"
      });
    }

    const allExercises = exercises.exercises;

    // Filtrar ejercicios por la dificultad del usuario
    const userLevelExercises = allExercises.filter(ex => ex.difficulty === difficulty);
    const exercisePool = userLevelExercises.length >= 10 ? userLevelExercises : allExercises;

    // Función auxiliar para seleccionar ejercicios aleatorios únicos
    const selectRandomExercises = (pool, count, excludeIds = []) => {
      const available = pool.filter(ex => !excludeIds.includes(ex.id));
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, available.length));
    };

    // Configuración según nivel
    let routineConfig;
    if (difficulty === 'beginner') {
      routineConfig = {
        exerciseCount: 6,
        sets: 3,
        reps: 12,
        restTime: 60,
        duration: 45
      };
    } else if (difficulty === 'intermediate') {
      routineConfig = {
        exerciseCount: 7,
        sets: 4,
        reps: 10,
        restTime: 75,
        duration: 60
      };
    } else {
      routineConfig = {
        exerciseCount: 8,
        sets: 4,
        reps: 8,
        restTime: 90,
        duration: 75
      };
    }

    // Generar 3 rutinas diferentes del mismo nivel
    const usedExerciseIds = [];

    // Rutina 1: Enfoque en cuerpo completo
    const routine1Exercises = selectRandomExercises(
      exercisePool,
      routineConfig.exerciseCount,
      usedExerciseIds
    ).map((ex, index) => {
      usedExerciseIds.push(ex.id);
      return {
        exercise_id: ex.id,
        name: ex.name,
        order_position: index + 1,
        sets: routineConfig.sets,
        reps: routineConfig.reps,
        rest_time: routineConfig.restTime,
        notes: difficulty === 'beginner'
          ? "Enfócate en la técnica correcta"
          : difficulty === 'intermediate'
          ? "Mantén una velocidad controlada"
          : "Maximiza la intensidad en cada serie"
      };
    });

    // Rutina 2: Enfoque en fuerza
    const routine2Exercises = selectRandomExercises(
      exercisePool,
      routineConfig.exerciseCount,
      usedExerciseIds
    ).map((ex, index) => {
      usedExerciseIds.push(ex.id);
      return {
        exercise_id: ex.id,
        name: ex.name,
        order_position: index + 1,
        sets: routineConfig.sets,
        reps: difficulty === 'beginner' ? 10 : routineConfig.reps - 2,
        rest_time: routineConfig.restTime + 15,
        notes: difficulty === 'beginner'
          ? "Aumenta el peso gradualmente"
          : difficulty === 'intermediate'
          ? "Enfócate en el rango de movimiento completo"
          : "Usa el peso más alto que puedas controlar"
      };
    });

    // Rutina 3: Enfoque en resistencia/tonificación
    const routine3Exercises = selectRandomExercises(
      exercisePool,
      routineConfig.exerciseCount,
      usedExerciseIds
    ).map((ex, index) => {
      return {
        exercise_id: ex.id,
        name: ex.name,
        order_position: index + 1,
        sets: routineConfig.sets,
        reps: difficulty === 'beginner' ? 15 : routineConfig.reps + 2,
        rest_time: routineConfig.restTime - 15,
        notes: difficulty === 'beginner'
          ? "Mantén un ritmo constante"
          : difficulty === 'intermediate'
          ? "Reduce los descansos progresivamente"
          : "Mantén la intensidad alta con descansos cortos"
      };
    });

    const levelNames = {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado'
    };

    const predefinedRoutines = [
      {
        id: "predefined-1",
        name: `Rutina Cuerpo Completo - ${levelNames[difficulty]}`,
        description: difficulty === 'beginner'
          ? "Una rutina completa diseñada para construir una base sólida de fuerza en todo el cuerpo. Perfecta para comenzar tu viaje fitness."
          : difficulty === 'intermediate'
          ? "Rutina balanceada que trabaja todos los grupos musculares. Ideal para desarrollar fuerza y resistencia de manera equilibrada."
          : "Rutina integral de alta intensidad que maximiza el desarrollo muscular en todo el cuerpo.",
        estimated_duration: routineConfig.duration,
        level: difficulty,
        goal: "general_fitness",
        exercises: routine1Exercises,
        days: difficulty === 'beginner' ? [1, 3, 5] : difficulty === 'intermediate' ? [1, 3, 5] : [1, 2, 4, 5],
        is_predefined: true
      },
      {
        id: "predefined-2",
        name: `Rutina de Fuerza - ${levelNames[difficulty]}`,
        description: difficulty === 'beginner'
          ? "Enfocada en desarrollar fuerza base con ejercicios fundamentales. Perfecta para ganar confianza y potencia."
          : difficulty === 'intermediate'
          ? "Programa diseñado para incrementar significativamente tu fuerza. Incluye ejercicios compuestos y aislados."
          : "Rutina avanzada de powerlifting y fuerza máxima. Diseñada para atletas experimentados.",
        estimated_duration: routineConfig.duration + 5,
        level: difficulty,
        goal: "build_muscle",
        exercises: routine2Exercises,
        days: difficulty === 'beginner' ? [2, 4, 6] : difficulty === 'intermediate' ? [1, 2, 4, 5] : [1, 2, 3, 5, 6],
        is_predefined: true
      },
      {
        id: "predefined-3",
        name: `Rutina de Resistencia - ${levelNames[difficulty]}`,
        description: difficulty === 'beginner'
          ? "Rutina orientada a mejorar tu resistencia muscular y cardiovascular. Ideal para quemar calorías y tonificar."
          : difficulty === 'intermediate'
          ? "Combina resistencia muscular con acondicionamiento. Perfecta para mejorar tu condición física general."
          : "Rutina de alto volumen e intensidad para maximizar resistencia y definición muscular.",
        estimated_duration: routineConfig.duration - 5,
        level: difficulty,
        goal: "lose_weight",
        exercises: routine3Exercises,
        days: difficulty === 'beginner' ? [1, 4] : difficulty === 'intermediate' ? [1, 2, 3, 5] : [1, 2, 3, 4, 5, 6],
        is_predefined: true
      }
    ];

    res.json({
      message: "Rutinas predefinidas obtenidas exitosamente",
      userLevel: userLevel,
      difficulty: difficulty,
      routines: predefinedRoutines,
      count: predefinedRoutines.length
    });
  } catch (error) {
    console.error("Error al obtener rutinas predefinidas:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al obtener rutinas predefinidas" });
  }
};
