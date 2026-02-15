import * as userRepository from "../repositories/userRepository.js";
import bcrypt from "bcryptjs";
import { generateAccessToken } from "../utils/jwtUtils.js";

const calculateBMI = (weight, height) => {
  if (!weight || !height || weight <= 0 || height <= 0) {
    return null;
  }
  // Convertir altura de cm a metros
  const heightInMeters = height / 100;
  // IMC = peso (kg) / altura² (m²)
  const bmi = weight / (heightInMeters * heightInMeters);
  // Redondear a 2 decimales
  return Math.round(bmi * 100) / 100;
};

export const register = async (userData) => {
  const {
    email,
    password,
    name,
    last_name,
    date_of_birth,
    weight,
    height,
    gender,
    bmi,
  } = userData;

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new Error("El usuario ya existe.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await userRepository.create({
    email,
    password: hashedPassword,
    name: name || null,
    last_name: last_name || null,
    date_of_birth: date_of_birth || null,
    weight: weight || null,
    height: height || null,
    gender: gender || null,
    bmi: bmi || null,
  });

  const accessToken = generateAccessToken(newUser.id, newUser.email);

  const { password: _, ...userWithoutPassword } = newUser;

  return { user: userWithoutPassword, accessToken };
};

export const login = async (email, password) => {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new Error("Credenciales inválidas");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error("Credenciales inválidas");
  }

  const accessToken = generateAccessToken(user.id, user.email);

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, accessToken };
};


export const getUsers = async () => {
  return await userRepository.findAll();
};

export const getUserById = async (userId) => {
  return await userRepository.findById(userId);
};

export const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  return user;
};

export const updateUser = async (userId, data) => {
  // Si se actualizan weight o height, calcular el IMC automáticamente
  if (data.weight !== undefined || data.height !== undefined) {
    // Obtener los valores actuales del usuario si no están en data
    const currentUser = await userRepository.findById(userId);

    const weight = data.weight !== undefined ? data.weight : currentUser.weight;
    const height = data.height !== undefined ? data.height : currentUser.height;

    // Calcular el IMC
    const bmi = calculateBMI(weight, height);

    // Agregar el IMC a los datos a actualizar
    data.bmi = bmi;
  }

  return await userRepository.update(userId, data);
};

export const getUserActivity = async (userId, options) => {
  if (!userId) {
    throw new Error("El ID del usuario es obligatorio");
  }

  // Validar que el usuario existe
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  return await userRepository.getUserActivity(userId, options);
};

export const setActiveRoutineForDay = async (userId, day, routineId) => {
  if (!userId) {
    throw new Error("El ID del usuario es obligatorio");
  }
  if (!routineId) {
    throw new Error("El ID de la rutina es obligatorio");
  }
  if (day === undefined || day === null) {
    throw new Error("El día es obligatorio");
  }

  const dayNum = parseInt(day, 10);
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) {
    throw new Error("El día debe ser un número entre 1 y 7");
  }

  return await userRepository.setActiveRoutineForDay(userId, dayNum, routineId);
};

export const getWeeklyActivity = async (userId, week, year) => {
  if (!userId) {
    throw new Error("El ID del usuario es obligatorio");
  }

  // Validar que el usuario existe
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  // Si no se proporciona semana o año, usar la semana actual
  const currentDate = new Date();
  const currentYear = year || currentDate.getFullYear();
  const currentWeek = week || getISOWeekNumber(currentDate);

  return await userRepository.getWeeklyActivity(userId, currentWeek, currentYear);
};

const getISOWeekNumber = (date) => {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  // Jueves de la semana actual
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  // Primer jueves del año
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  // Calcular el número de semana
  return 1 + Math.round(((tempDate - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};
