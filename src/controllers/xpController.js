import * as xpService from "../services/xpService.js";

export const awardXp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { actionType, metadata, customXp } = req.body;

    if (!actionType) {
      return res.status(400).json({
        error: "El tipo de acción (actionType) es requerido",
      });
    }

    const result = await xpService.awardXp(
      userId,
      actionType,
      metadata,
      customXp
    );

    res.status(200).json({
      message: result.leveledUp
        ? `¡Felicidades! Has subido al nivel ${result.level}`
        : "XP otorgado exitosamente",
      ...result,
    });
  } catch (error) {
    console.error("Error al otorgar XP:", error);
    res.status(400).json({
      error: error.message || "Error al otorgar XP",
    });
  }
};

export const getXpHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit, offset, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      startDate,
      endDate,
    };

    const result = await xpService.getXpHistory(userId, options);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener historial de XP:", error);
    res.status(400).json({
      error: error.message || "Error al obtener historial de XP",
    });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await xpService.getUserStats(userId);

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas del usuario:", error);
    res.status(400).json({
      error: error.message || "Error al obtener estadísticas del usuario",
    });
  }
};

export const getXpConfig = async (req, res) => {
  try {
    const config = xpService.getXpConfig();
    res.status(200).json(config);
  } catch (error) {
    console.error("Error al obtener configuración de XP:", error);
    res.status(500).json({
      error: error.message || "Error al obtener configuración de XP",
    });
  }
};
