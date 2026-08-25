import * as invitationService from "../services/invitationService.js";

export const sendInvitation = async (req, res) => {
  try {
    const { email, gym_id } = req.body;
    const invitation = await invitationService.sendInvitation({
      email,
      gym_id,
    });
    res.status(201).json({
      message: "Invitación enviada exitosamente",
      success: true,
      data: invitation,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error enviando invitación",
      success: false,
      error: error.message,
    });
  }
};

export const acceptInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID requerido", success: false });
    }
    const result = await invitationService.acceptInvitation(id);
    res.status(200).json({
      message: "Invitación aceptada exitosamente",
      success: true,
      data: {
        invitation: result.invitation,
        membership: result.membership,
      },
    });
  } catch (error) {
    if (error.message === "INVITATION_NOT_FOUND") {
      return res.status(404).json({
        message: "Invitación no encontrada",
        success: false,
      });
    }
    if (error.message === "INVITATION_ALREADY_PROCESSED") {
      return res.status(409).json({
        message: "La invitación ya fue procesada anteriormente",
        success: false,
      });
    }
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        message:
          "No existe un usuario registrado con el email de la invitación",
        success: false,
      });
    }
    if (error.message === "USER_ALREADY_MEMBER") {
      return res.status(409).json({
        message: "El usuario ya es miembro de un gimnasio",
        success: false,
      });
    }
    res.status(500).json({
      message: "Error aceptando invitación",
      success: false,
      error: error.message,
    });
  }
};

export const getInvitationsByUserEmail = async (req, res) => {
  try {
    const { email } = req.user;
    const invitations = await invitationService.getInvitationsByUserEmail(email);
    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo invitaciones",
      success: false,
      error: error.message,
    });
  }
};


export const listGymInvitations = async (req, res) => {
  try {
    const { gymId } = req.params;
    const { status, limit } = req.query;

    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      return res.status(400).json({
        message: "limit debe ser un entero positivo",
        success: false,
      });
    }

    const result = await invitationService.getGymInvitations(gymId, {
      status: status ? String(status).toUpperCase() : undefined,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.message === "INVALID_STATUS") {
      return res.status(400).json({
        message: "status inválido. Valores permitidos: PENDING, ACCEPTED, REJECTED",
        success: false,
      });
    }
    console.error("listGymInvitations failed:", error);
    res.status(500).json({
      message: "Error obteniendo el historial de invitaciones",
      success: false,
      error: error.message,
    });
  }
};
