import * as gymClassService from "../services/gymClassService.js";

const BODY_FIELDS = [
  "instructor_id",
  "activity",
  "name",
  "date",
  "start_minutes",
  "duration_minutes",
  "room",
  "capacity",
  "color",
  "enrolled",
];

const VALIDATION_ERRORS = {
  INVALID_RANGE:
    "Rango de fechas inválido. Envía from y to en formato yyyy-mm-dd",
  RANGE_TOO_LARGE: "El rango de fechas no puede superar los 62 días",
  INVALID_DATE: "Fecha de la clase inválida. Usa el formato yyyy-mm-dd",
  INVALID_DURATION: "La duración debe ser un entero de minutos mayor a 0",
  INVALID_CAPACITY: "El aforo debe ser un entero mayor o igual a 1",
  INVALID_START:
    "La hora de inicio es inválida o la clase termina después de medianoche",
  INVALID_INPUT: "Datos de la clase inválidos o incompletos",
  ENROLLED_EXCEEDS_CAPACITY: "Los inscritos no pueden superar el aforo",
  INSTRUCTOR_NOT_IN_GYM: "El entrenador no pertenece a este gimnasio",
  INSTRUCTOR_NOT_TRAINER: "El usuario seleccionado no tiene rol de entrenador",
};

const NOT_FOUND_ERRORS = {
  CLASS_NOT_FOUND: "Clase no encontrada",
  INSTRUCTOR_NOT_FOUND: "Entrenador no encontrado",
};

const pickBodyFields = (body = {}) => {
  const payload = {};
  for (const field of BODY_FIELDS) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return payload;
};

const toClassDto = (cls) => ({
  id: cls.id,
  gym_id: cls.gym_id,
  instructor_id: cls.instructor_id,
  activity: cls.activity,
  name: cls.name,
  date: cls.class_date.toISOString().slice(0, 10),
  start_minutes: cls.start_minutes,
  duration_minutes: cls.duration_minutes,
  room: cls.room,
  capacity: cls.capacity,
  enrolled: cls.enrolled,
  color: cls.color,
  instructor: cls.instructor,
  created_at: cls.created_at,
  updated_at: cls.updated_at,
});

const handleError = (res, error, logMessage) => {
  if (VALIDATION_ERRORS[error.message]) {
    return res.status(400).json({ error: VALIDATION_ERRORS[error.message] });
  }
  if (NOT_FOUND_ERRORS[error.message]) {
    return res.status(404).json({ error: NOT_FOUND_ERRORS[error.message] });
  }
  if (error.code === "P2025") {
    return res.status(404).json({ error: "Clase no encontrada" });
  }
  console.error(logMessage, error);
  return res.status(500).json({ error: "Error interno del servidor." });
};

export const listClasses = async (req, res) => {
  try {
    const { gymId } = req.params;
    const { from, to } = req.query;

    const classes = await gymClassService.listClasses(gymId, { from, to });

    res.json({ success: true, data: classes.map(toClassDto) });
  } catch (error) {
    handleError(res, error, "Error al obtener clases del gym:");
  }
};

export const createClass = async (req, res) => {
  try {
    const { gymId } = req.params;

    const created = await gymClassService.createClass(
      gymId,
      pickBodyFields(req.body),
    );

    res.status(201).json({ success: true, data: toClassDto(created) });
  } catch (error) {
    handleError(res, error, "Error al crear la clase:");
  }
};

export const updateClass = async (req, res) => {
  try {
    const { gymId, classId } = req.params;

    const updated = await gymClassService.updateClass(
      gymId,
      classId,
      pickBodyFields(req.body),
    );

    res.json({ success: true, data: toClassDto(updated) });
  } catch (error) {
    handleError(res, error, "Error al actualizar la clase:");
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { gymId, classId } = req.params;

    await gymClassService.deleteClass(gymId, classId);

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Error al eliminar la clase:");
  }
};
