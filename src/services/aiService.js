import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
    const completion = await groq.chat.completions.create({
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

    const responseText = completion.choices[0]?.message?.content;

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
