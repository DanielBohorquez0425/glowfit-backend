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
    }),
  ]);

  return { invitation: updatedInvitation, membership };
};

export const getMembersByGymId = async (gymId) => {
  if (!gymId) {
    throw new Error("El ID del gym es obligatorio");
  }
  const members = await gymMembershipRepository.findMembersByGymId(gymId);

  return members.map((m) => ({
    membership_id: m.id,
    gym_id: m.gym_id,
    status: m.status,
    role: m.role,
    plan: m.plan,
    start_date: m.start_date,
    end_date: m.end_date,
    created_at: m.created_at,
    user: m.users_gym_memberships_user_idTousers,
  }));
};
