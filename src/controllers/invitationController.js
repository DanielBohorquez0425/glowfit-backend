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
