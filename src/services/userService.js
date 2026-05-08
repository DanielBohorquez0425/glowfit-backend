import * as userRepository from "../repositories/userRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "../utils/jwtUtils.js";
import { sendPasswordResetCode } from "./emailService.js";

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

  const accessToken = generateAccessToken(newUser.id, newUser.email, newUser.token_version);

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

  const newTokenVersion = await userRepository.incrementTokenVersion(user.id);
  const accessToken = generateAccessToken(user.id, user.email, newTokenVersion);

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, accessToken };
};


export const getUsers = async () => {
  return await userRepository.findAll();
};

const mapGymMembership = (rawMembership) => {
  if (!rawMembership) return null;
  return {
    gym_id: rawMembership.gym_id,
    status: rawMembership.status,
    gym_roles: rawMembership.gym_roles,
    active_role: rawMembership.active_role,
    plan: rawMembership.plan,
    start_date: rawMembership.start_date,
    end_date: rawMembership.end_date,
    gym: rawMembership.gyms,
  };
};

export const getUserById = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) return null;

  const { gym_membership, ...rest } = user;

  const mappedMembership = mapGymMembership(gym_membership);

  return {
    ...rest,
    gym_membership: mappedMembership,
  };
};

export const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const { gym_membership, ...rest } = user;

  const mappedMembership = mapGymMembership(gym_membership);

  return {
    ...rest,
    gym_membership: mappedMembership,
  };
};

export const switchActiveRole = async (userId, role) => {
  const membership = await gymMembershipRepository.findMembershipByUserId(userId);

  if (!membership) {
    throw new Error("NO_MEMBERSHIP");
  }

  if (!membership.gym_roles.includes(role)) {
    throw new Error("ROLE_NOT_IN_MEMBERSHIP");
  }

  const updated = await gymMembershipRepository.setActiveRole(membership.id, role);

  return mapGymMembership(updated);
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

// ── Password Reset ────────────────────────────────────────────────────────────

export const forgotPassword = async (email) => {
  const user = await userRepository.findByEmail(email);
  // Responder siempre 200 para no revelar si el email existe
  if (!user) return;

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 10);

  await userRepository.createPasswordResetCode(user.id, hashedCode);
  await sendPasswordResetCode(email, code);
};

export const verifyResetCode = async (email, code) => {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new Error("INVALID_CODE");

  const record = await userRepository.findActiveResetCode(user.id);
  if (!record) throw new Error("INVALID_CODE");

  const isValid = await bcrypt.compare(code, record.code);
  if (!isValid) throw new Error("INVALID_CODE");

  await userRepository.markResetCodeAsUsed(record.id);

  const resetToken = jwt.sign(
    { userId: user.id, purpose: "password_reset" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  return { reset_token: resetToken };
};

export const resetPassword = async (resetToken, newPassword) => {
  let payload;
  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch {
    throw new Error("INVALID_TOKEN");
  }

  if (payload.purpose !== "password_reset") throw new Error("INVALID_TOKEN");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(payload.userId, hashedPassword);
};

// ─────────────────────────────────────────────────────────────────────────────

// ── Gym Owner Creation ───────────────────────────────────────────────────────

export const createGymOwner = async (userData, gymId, assignedById) => {
  const { email, password, name, last_name, role, plan, notes } = userData;

  // Validar campos obligatorios del usuario
  if (!email || !password) {
    throw new Error("EMAIL_AND_PASSWORD_REQUIRED");
  }

  // Validar que el email no exista
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new Error("USER_ALREADY_EXISTS");
  }

  // Validar que el gym exista
  if (!gymId) {
    throw new Error("GYM_ID_REQUIRED");
  }

  // Hash de la contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  // Crear usuario + membresía atómicamente (valida gym dentro de la transacción)
  const result = await userRepository.createGymOwner(
    {
      email,
      password: hashedPassword,
      name: name || null,
      last_name: last_name || null,
      role: role || "USER",
      assigned_by: assignedById || null,
      plan: plan || null,
      notes: notes || null,
    },
    gymId
  );

  // Retornar sin password
  const { password: _, ...userWithoutPassword } = result.user;

  return {
    user: userWithoutPassword,
    gym: result.gym,
    membership: result.membership,
  };
};

// ── Gym Admin Creation (solo GYM_OWNER puede crear) ──────────────────────────

export const createGymAdmin = async (ownerId, userData) => {
  const { email, password, name, last_name, role, plan, notes } = userData;

  // Validar campos obligatorios
  if (!email || !password) {
    throw new Error("EMAIL_AND_PASSWORD_REQUIRED");
  }

  // Hash de la contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  // Crear usuario + membresía (valida owner y gym dentro de la transacción)
  const result = await userRepository.createGymAdmin(ownerId, {
    email,
    password: hashedPassword,
    name: name || null,
    last_name: last_name || null,
    role: role || "USER",
    plan: plan || null,
    notes: notes || null,
  });

  // Retornar sin password
  const { password: _, ...userWithoutPassword } = result.user;

  return {
    user: userWithoutPassword,
    gym: result.gym,
    membership: result.membership,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

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
