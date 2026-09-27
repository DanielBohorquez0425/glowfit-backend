import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Llama al endpoint de chat completions de OpenRouter y devuelve el
 * contenido de texto de la respuesta.
 */
const createChatCompletion = async ({ model, messages, temperature, max_tokens }) => {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter respondió ${response.status}`);
  }

  return data.choices?.[0]?.message?.content;
};

const TEXT_MODEL_FALLBACK_CHAIN = [
  "openai/gpt-6-luna",
  "meta/muse-spark-1.3-contributor",
  "meta/muse-spark-1.2-contributor",
];

/**
 * Llama a createChatCompletion probando cada modelo de TEXT_MODEL_FALLBACK_CHAIN
 * en orden, hasta que uno responda correctamente.
 */
const createChatCompletionWithFallback = async ({ messages, temperature, max_tokens }) => {
  let lastError;

  for (const model of TEXT_MODEL_FALLBACK_CHAIN) {
    try {
      return await createChatCompletion({ model, messages, temperature, max_tokens });
    } catch (error) {
      console.error(`Modelo ${model} falló, probando siguiente:`, error.message);
      lastError = error;
    }
  }

  throw lastError;
};

/**
 * Calcula la edad a partir de la fecha de nacimiento
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

/**
 * Genera una rutina personalizada usando IA basándose en el perfil del usuario
 * @param {Object} userProfile - Perfil del usuario (weight, height, date_of_birth, gender, goal)
 * @param {Array} exercises - Lista de ejercicios disponibles
 * @returns {Object} - Rutina generada por la IA
 */
export const generateRoutineWithAI = async (userProfile, exercises) => {
  const age = calculateAge(userProfile.date_of_birth);

  const exerciseList = exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscle_group_id: ex.muscle_group_id,
  }));

  // Formatear los días de entrenamiento del usuario
  const dayNames = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    7: "Domingo",
  };

  const trainingDays =
    userProfile.user_training_days?.map((td) => td.day_id) || [];
  const trainingDaysFormatted =
    trainingDays.length > 0
      ? trainingDays.map((dayId) => `${dayId} (${dayNames[dayId]})`).join(", ")
      : "No especificado";

  // Agrupar ejercicios por grupo muscular y tomar solo 8 por grupo
  const exercisesByGroup = exercises.reduce((acc, ex) => {
    if (!acc[ex.muscle_group_id]) {
      acc[ex.muscle_group_id] = [];
    }
    acc[ex.muscle_group_id].push(ex);
    return acc;
  }, {});

  // Tomar máximo 8 ejercicios por grupo muscular
  const filteredExercises = [];
  Object.keys(exercisesByGroup).forEach((groupId) => {
    const groupExercises = exercisesByGroup[groupId].slice(0, 8);
    filteredExercises.push(...groupExercises);
  });

  // Formato compacto de ejercicios para reducir tokens
  const exercisesCompact = filteredExercises.map((ex) => `${ex.id}|${ex.name}|G${ex.muscle_group_id}`).join("\n");

  const prompt = `
TAREA
Genera rutinas de entrenamiento estructuradas según el perfil del usuario.

PERFIL
Peso: ${userProfile.weight ?? "N/A"} kg
Altura: ${userProfile.height ?? "N/A"} cm
Edad: ${age ?? "N/A"}
Género: ${userProfile.gender ?? "N/A"}
Objetivo: ${userProfile.goal ?? "general"}
Días disponibles: ${trainingDaysFormatted}

REGLAS OBLIGATORIAS
- Genera ${trainingDays.length || 3} rutinas con días únicos (1–7)
- Máximo 6 ejercicios por rutina
- No repitas ejercicios dentro de la misma rutina
- Ajusta volumen e intensidad según edad y objetivo
- Si hay discapacidad, evita ejercicios inseguros
- Usa SOLO exercise_id proporcionados
- No inventes ejercicios
- No incluyas texto explicativo

PARÁMETROS
- Sets: 2–5
- Reps:
  - Fuerza: 4–6
  - Hipertrofia: 8–12
  - Resistencia: 15–20
- Descanso: 45–180 segundos

EJERCICIOS DISPONIBLES
Formato: id|nombre|grupo
${exercisesCompact}

FORMATO DE RESPUESTA
Devuelve EXCLUSIVAMENTE un JSON válido.
No incluyas texto fuera del JSON.
No incluyas descripciones ni notas.

Estructura exacta:
{
  "routines": [
    {
      "name": "string",
      "estimated_duration": 60,
      "level": "principiante|intermedio|avanzado",
      "goal": "${userProfile.goal ?? "general"}",
      "day": 1,
      "exercises": [
        {
          "exercise_id": "uuid",
          "order_position": 1,
          "sets": 3,
          "reps": 10,
          "rest_time": 60
        }
      ]
    }
  ]
}
`;

  try {
    const responseText = await createChatCompletion({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.3,
      max_tokens: 4000,
    });

    if (!responseText) {
      throw new Error("No se recibió respuesta de la IA");
    }

    // Extraer JSON de la respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("La respuesta de la IA no contiene un JSON válido");
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Validar que la respuesta contenga el array de rutinas
    if (!aiResponse.routines || !Array.isArray(aiResponse.routines)) {
      throw new Error(
        "La respuesta de la IA no contiene un array de rutinas válido"
      );
    }

    if (aiResponse.routines.length === 0) {
      throw new Error("La IA no generó ninguna rutina");
    }

    // Validar que los exercise_id existan en la lista de ejercicios para cada rutina
    const validExerciseIds = new Set(exercises.map((ex) => ex.id));

    aiResponse.routines = aiResponse.routines.map((routine) => {
      // Filtrar ejercicios válidos
      routine.exercises = routine.exercises.filter((ex) =>
        validExerciseIds.has(ex.exercise_id)
      );
      return routine;
    });

    // Eliminar rutinas sin ejercicios válidos
    aiResponse.routines = aiResponse.routines.filter(
      (routine) => routine.exercises.length > 0
    );

    if (aiResponse.routines.length === 0) {
      throw new Error("La IA no generó ejercicios válidos en ninguna rutina");
    }

    return aiResponse;
  } catch (error) {
    console.error("Error al generar rutina con IA:", error);
    throw new Error(`Error al generar rutina con IA: ${error.message}`);
  }
};

/**
 * Estima las macros de una comida a partir de una descripción en lenguaje natural.
 * @param {string} description - Ej: "2 huevos fritos con 1 vaso de leche"
 * @returns {Object} - { calories, protein_g, fat_g, carbs_g }
 */
export const estimateMealMacrosWithAI = async (description) => {
  const prompt = `
TAREA
Estima los macronutrientes de la siguiente comida descrita por el usuario.

COMIDA
"${description}"

REGLAS
- Basa la estimación en porciones estándar/promedio para los alimentos mencionados.
- Si la cantidad de un alimento no se especifica, asume una porción individual estándar.
- No incluyas texto explicativo.

FORMATO DE RESPUESTA
Devuelve EXCLUSIVAMENTE un JSON válido, sin texto fuera del JSON.

Estructura exacta:
{
  "calories": 350,
  "protein_g": 20.5,
  "fat_g": 15.2,
  "carbs_g": 30.1
}
`;

  try {
    const responseText = await createChatCompletionWithFallback({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    if (!responseText) {
      throw new Error("No se recibió respuesta de la IA");
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("La respuesta de la IA no contiene un JSON válido");
    }

    const macros = JSON.parse(jsonMatch[0]);

    const isValidNonNegativeNumber = (value) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0;

    if (
      !isValidNonNegativeNumber(macros.calories) ||
      !isValidNonNegativeNumber(macros.protein_g) ||
      !isValidNonNegativeNumber(macros.fat_g) ||
      !isValidNonNegativeNumber(macros.carbs_g)
    ) {
      throw new Error("La respuesta de la IA no contiene macros válidos");
    }

    return {
      calories: Math.round(macros.calories),
      protein_g: macros.protein_g,
      fat_g: macros.fat_g,
      carbs_g: macros.carbs_g,
    };
  } catch (error) {
    console.error("Error al estimar macros con IA:", error);
    throw new Error(`Error al estimar macros con IA: ${error.message}`);
  }
};
