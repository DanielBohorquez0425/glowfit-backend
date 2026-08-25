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


const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"];

const buildSummary = (counts) => {
  const summary = { total: 0, pending: 0, accepted: 0, rejected: 0 };
  for (const row of counts) {
    const amount = row._count._all;
    summary.total += amount;
    summary[row.status.toLowerCase()] = amount;
  }
  return summary;
};

export const getGymInvitations = async (gymId, { status, limit } = {}) => {
  if (status && !INVITATION_STATUSES.includes(status)) {
    throw new Error("INVALID_STATUS");
  }

  const [invitations, counts] = await Promise.all([
    invitationRepository.findInvitationsByGymId(gymId, { status, limit }),
    invitationRepository.countInvitationsByStatus(gymId),
  ]);

  // Una invitación puede existir sin usuario: el invitado todavía no se registró
  // en la app. Ese cruce es lo que distingue "no se registró" de "se registró
  // pero no aceptó", y es la información que el admin necesita para hacer seguimiento.
  const emails = [...new Set(invitations.map((inv) => inv.email))];
  const users = emails.length
    ? await userRepository.findManyByEmails(emails)
    : [];
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  return {
    summary: buildSummary(counts),
    invitations: invitations.map((inv) => {
      const user = usersByEmail.get(inv.email) ?? null;
      return {
        id: inv.id,
        email: inv.email,
        status: inv.status,
        gym_id: inv.gym_id,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
        is_registered: Boolean(user),
        user: user
          ? {
              id: user.id,
              name: user.name,
              last_name: user.last_name,
              registered_at: user.created_at,
            }
          : null,
      };
    }),
  };
};
