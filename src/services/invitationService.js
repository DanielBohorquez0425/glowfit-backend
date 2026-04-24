import * as invitationRepository from "../repositories/invitationRepository.js";

export const sendInvitation = async (invitationData) => {
  const { email, gym_id } = invitationData;
  const existingInvitation = await invitationRepository.findUniqueInvitation(
    email,
    gym_id,
  );

  if (existingInvitation) {
    throw new Error("Este usuario ya ha sido invitado a este gimnasio");
  }

  return await invitationRepository.sendInvitation(invitationData);
};
