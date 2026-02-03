import * as userService from "../services/userService.js";

// Registro de usuario
export const register = async (req, res) => {
  const { email, password, name, last_name } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "El email y la contraseña son obligatorios." });
  }

  try {
    const result = await userService.register({
      email,
      password,
      name,
      last_name,
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error.message === "El usuario ya existe.") {
      return res.status(409).json({ error: error.message });
    }
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ error: "Error interno al crear usuario." });
  }
};

// Login de usuario
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email y contraseña son obligatorios" });
  }

  try {
    const result = await userService.login(email, password);
    return res.json(result);
  } catch (error) {
    if (error.message === "Credenciales inválidas") {
      return res.status(401).json({ error: error.message });
    }
    console.error("Error en login:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Logout de usuario
export const logout = async (req, res) => {
  try {
    // En un sistema basado en JWT sin refresh tokens,
    // el logout se maneja en el cliente eliminando el accessToken
    return res.json({
      message: "Sesión cerrada exitosamente. El token debe ser eliminado del cliente."
    });
  } catch (error) {
    console.error("Error en logout:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};


// Obtener usuarios (protegido)
export const getUsers = async (req, res) => {
  try {
    const users = await userService.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

// Obtener perfil del usuario autenticado
export const getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user.userId);
    res.json(user);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Error al obtener perfil" });
  }
};

// Obtener usuario por ID
export const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  const { id } = req.params;
  let data = req.body;

  // Validación: verificar que req.body exista
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Datos inválidos." });
  }

  // Prevenir actualización de campos sensibles o inmutables
  const {
    id: _,
    email,
    password,
    created_at,
    updated_at,
    goal_id, // Extraer goal_id para manejarlo por separado
    ...allowedData
  } = data;

  // Si viene goal_id, convertirlo a la relación correcta
  if (goal_id !== undefined) {
    allowedData.goals = {
      connect: { id: goal_id },
    };
  }

  // Validación: comprobar si hay datos para actualizar DESPUÉS de filtrar
  if (Object.keys(allowedData).length === 0) {
    return res
      .status(400)
      .json({ error: "No se proporcionaron datos válidos para actualizar." });
  }

  // Si viene date_of_birth, asegurarse de que es un objeto Date
  if (allowedData.date_of_birth) {
    allowedData.date_of_birth = new Date(allowedData.date_of_birth);
  }

  // Validar que no haya day_id duplicados en user_training_days
  if (allowedData.user_training_days?.create) {
    const dayIds = allowedData.user_training_days.create.map(d => d.day_id);
    const uniqueDayIds = new Set(dayIds);

    if (dayIds.length !== uniqueDayIds.size) {
      return res.status(400).json({
        error: "No se pueden asignar días de entrenamiento duplicados."
      });
    }
  }

  try {
    const updatedUser = await userService.updateUser(id, allowedData);
    res.json(updatedUser);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error interno al actualizar usuario." });
  }
};

export const createUser = register;

export const getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, page, startDate, endDate, month } = req.query;

    // Autorización: el usuario solo puede ver su propia actividad
    if (req.user.userId !== id) {
      return res.status(403).json({
        error: "No tienes permiso para ver la actividad de este usuario",
      });
    }

    const parsedLimit = limit ? parseInt(limit) : 10;
    const parsedPage = page ? parseInt(page) : 1;
    const offset = (parsedPage - 1) * parsedLimit;

    const options = {
      limit: parsedLimit,
      offset: offset,
      startDate,
      endDate,
      month: month ? parseInt(month) : undefined,
    };

    const result = await userService.getUserActivity(id, options);
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
      data: result.completions.map((completion) => ({
        id: completion.id,
        completed_at: completion.completed_at,
        day_of_week: completion.day_of_week,
        routine: completion.routine,
      })),
    });
  } catch (error) {
    console.error("Error al obtener actividad del usuario:", error);

    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: error.message || "Error al obtener actividad del usuario",
    });
  }
};

// Activar una rutina específica para un día
export const setActiveRoutine = async (req, res) => {
  try {
    const { userId } = req.params;
    const { day, routineId } = req.body;

    // Autorización: el usuario solo puede modificar sus propias rutinas
    if (req.user.userId !== userId) {
      return res.status(403).json({
        error: "No tienes permiso para modificar las rutinas de este usuario",
      });
    }

    // Validar campos requeridos
    if (day === undefined || day === null) {
      return res.status(400).json({ error: "El campo 'day' es obligatorio" });
    }
    if (!routineId) {
      return res
        .status(400)
        .json({ error: "El campo 'routineId' es obligatorio" });
    }

    const result = await userService.setActiveRoutineForDay(
      userId,
      day,
      routineId
    );

    res.json(result);
  } catch (error) {
    console.error("Error al activar rutina:", error);

    if (error.message === "ROUTINE_NOT_FOUND") {
      return res.status(404).json({
        error: "La rutina no existe o no pertenece al usuario",
      });
    }

    if (error.message === "ROUTINE_NOT_ASSIGNED_TO_DAY") {
      return res.status(400).json({
        error: "La rutina no está asignada al día especificado",
      });
    }

    if (
      error.message === "El día debe ser un número entre 1 y 7" ||
      error.message === "El día es obligatorio" ||
      error.message === "El ID de la rutina es obligatorio" ||
      error.message === "El ID del usuario es obligatorio"
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: error.message || "Error al activar la rutina",
    });
  }
};
