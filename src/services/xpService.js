import * as xpRepository from "../repositories/xpRepository.js";

// Configuración del sistema de XP
const XP_CONFIG = {
  XP_PER_LEVEL: 1000,
  ACTIONS: {
    COMPLETE_ROUTINE: {
      xp: 100,
      maxPerHour: 10,
    },
    COMPLETE_EXERCISE: {
      xp: 20,
      maxPerHour: 30,
    },
  },
};

export const calculateLevel = (xp) => {
  return Math.floor(xp / XP_CONFIG.XP_PER_LEVEL) + 1;
};

export const getXpForNextLevel = (currentXp) => {
  const currentLevel = calculateLevel(currentXp);
  const xpForNextLevel = currentLevel * XP_CONFIG.XP_PER_LEVEL;
  return xpForNextLevel - currentXp;
};

export const getProgressInCurrentLevel = (currentXp) => {
  const xpInCurrentLevel = currentXp % XP_CONFIG.XP_PER_LEVEL;
  const progressPercentage = (xpInCurrentLevel / XP_CONFIG.XP_PER_LEVEL) * 100;
  return {
    xpInCurrentLevel,
    xpNeededForNextLevel: XP_CONFIG.XP_PER_LEVEL - xpInCurrentLevel,
    progressPercentage: Math.round(progressPercentage * 100) / 100,
  };
};

const validateAction = async (userId, actionType) => {
  const actionConfig = XP_CONFIG.ACTIONS[actionType];

  if (!actionConfig) {
    throw new Error("Tipo de acción no válida");
  }

  const recentCompletions = await xpRepository.countRecentCompletions(
    userId,
    actionType,
    60
  );

  if (recentCompletions >= actionConfig.maxPerHour) {
    throw new Error(
      `Has alcanzado el límite de ${actionConfig.maxPerHour} acciones de tipo '${actionType}' por hora. Intenta más tarde.`
    );
  }

  return actionConfig;
};

export const awardXp = async (
  userId,
  actionType,
  metadata = {},
  customXp = null
) => {
  const actionConfig = await validateAction(userId, actionType);
  const xpToAward = customXp !== null ? customXp : actionConfig.xp;

  const userData = await xpRepository.getUserXpData(userId);
  if (!userData) {
    throw new Error("Usuario no encontrado");
  }

  const oldXp = userData.xp;
  const oldLevel = userData.level;
  const newXp = oldXp + xpToAward;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;

  await xpRepository.createXpTransaction({
    user_id: userId,
    xp_amount: xpToAward,
    action_type: actionType,
    routine_completion_id: metadata.routine_completion_id || null,
    metadata: {
      ...metadata,
      old_xp: oldXp,
      new_xp: newXp,
      old_level: oldLevel,
      new_level: newLevel,
      leveled_up: leveledUp,
    },
  });

  const updatedUser = await xpRepository.updateUserXp(userId, newXp, newLevel);

  const progress = getProgressInCurrentLevel(newXp);

  return {
    xpAwarded: xpToAward,
    totalXp: newXp,
    level: newLevel,
    leveledUp,
    levelsGained: leveledUp ? newLevel - oldLevel : 0,
    progress,
    user: updatedUser,
  };
};

export const getXpHistory = async (userId, options = {}) => {
  if (!userId) {
    throw new Error("El ID de usuario es obligatorio");
  }

  return await xpRepository.getUserXpTransactions(userId, options);
};

export const getUserStats = async (userId) => {
  if (!userId) {
    throw new Error("El ID de usuario es obligatorio");
  }

  const userData = await xpRepository.getUserXpData(userId);
  if (!userData) {
    throw new Error("Usuario no encontrado");
  }

  const progress = getProgressInCurrentLevel(userData.xp);

  return {
    userId: userData.id,
    xp: userData.xp,
    level: userData.level,
    ...progress,
  };
};

export const getXpConfig = () => {
  return {
    xpPerLevel: XP_CONFIG.XP_PER_LEVEL,
    actions: Object.keys(XP_CONFIG.ACTIONS).map((key) => ({
      action: key,
      xp: XP_CONFIG.ACTIONS[key].xp,
      maxPerHour: XP_CONFIG.ACTIONS[key].maxPerHour,
    })),
  };
};
