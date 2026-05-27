import * as invitationRepository from "../repositories/invitationRepository.js";
import * as gymMembershipRepository from "../repositories/gymMembershipRepository.js";
import * as userRepository from "../repositories/userRepository.js";

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

export const acceptInvitation = async (invitationId) => {
  const invitation =
    await invitationRepository.findInvitationById(invitationId);

  if (!invitation) {
    throw new Error("INVITATION_NOT_FOUND");
  }

  if (invitation.status !== "PENDING") {
    throw new Error("INVITATION_ALREADY_PROCESSED");
  }

  const user = await userRepository.findByEmail(invitation.email);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const existingMembership =
    await gymMembershipRepository.findMembershipByUserId(user.id);
  if (existingMembership) {
    throw new Error("USER_ALREADY_MEMBER");
  }

  const [updatedInvitation, membership] = await Promise.all([
    invitationRepository.acceptInvitation(invitationId),
    gymMembershipRepository.createMembership({
      gym_id: invitation.gym_id,
      user_id: user.id,
      gym_roles: ["MEMBER"],
      active_role: "MEMBER",
    }),
  ]);

  return { invitation: updatedInvitation, membership };
};

export const getInvitationsByUserEmail = async (email) => {
  if (!email) {
    throw new Error("El email es obligatorio");
  }
  const invitations =
    await invitationRepository.getInvitationByUserEmail(email);
  return invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    status: inv.status,
    gym_id: inv.gym_id,
    gym_name: inv.gyms?.name,
    created_at: inv.created_at,
  }));
};


