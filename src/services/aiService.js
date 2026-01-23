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

  // Formato compacto de ejercicios para reducir tokens
  const exercisesCompact = exercises.map((ex) => `${ex.id}|${ex.name}|G${ex.muscle_group_id}`).join("\n");

  const prompt = `Entrenador personal: Crea plan de entrenamiento personalizado.

PERFIL:
Peso: ${userProfile.weight || "N/A"}kg | Altura: ${userProfile.height || "N/A"}cm | Edad: ${age || "N/A"} | Género: ${userProfile.gender || "N/A"}
Objetivo: ${userProfile.goal || "General fitness"}
${userProfile.has_disability ? `Discapacidad: ${userProfile.disability_description || "Sí"}` : ""}
Días: ${trainingDaysFormatted}

REGLAS:
1. Si hay discapacidad, adapta ejercicios para seguridad
2. ${trainingDays.length > 0 ? `Crea ${trainingDays.length} rutinas (días: ${trainingDays.join(", ")}) con grupos musculares diferentes` : "Genera 3 rutinas balanceadas"}
3. 6-10 ejercicios/rutina
4. Sets: 2-5 | Reps según objetivo (fuerza:4-6, hipertrofia:8-12, resistencia:15-20) | Rest: 45-180s
5. Considera edad y nivel

EJERCICIOS (formato: ID|Nombre|Grupo):
${exercisesCompact}

Responde SOLO JSON:
{
  "routines": [
    {
      "name": "Rutina [Día] - [Grupos]",
      "description": "Breve descripción",
      "estimated_duration": 60,
      "level": "principiante|intermedio|avanzado",
      "goal": "${userProfile.goal || "General fitness"}",
      "day": 1,
      "exercises": [{"exercise_id": "uuid", "order_position": 1, "sets": 3, "reps": 12, "rest_time": 60, "notes": "Consejo breve"}]
    }
  ]
}

IMPORTANTE: Usa SOLO exercise_id de la lista. Genera ${trainingDays.length || 3} rutinas con días únicos (1-7). No repetir días.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
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
