import { Resend } from "resend";

let _resend = null;
const getResend = () => {
  if (!_resend) _resend = new Resend(process.env.RESEND_KEY);
  return _resend;
};

export const sendPasswordResetCode = async (email, code) => {
  await getResend().emails.send({
    from: `GlowFit <onboarding@${process.env.EMAIL_DOMAIN}>`,
    to: email,
    subject: "Tu código de verificación - GlowFit",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Restablecer contraseña</h2>
        <p style="color: #555; margin-bottom: 24px;">Usa el siguiente código para continuar. Expira en <strong>10 minutos</strong>.</p>
        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; text-align: center; letter-spacing: 8px; font-size: 36px; font-weight: bold; color: #1a1a1a;">
          ${code}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Si no solicitaste este código, ignora este mensaje.</p>
      </div>
    `,
  });
};

export const sendPasswordSetupEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const setupLink = `${frontendUrl}/setup-password?token=${token}`;

  await getResend().emails.send({
    from: `GlowFit <onboarding@${process.env.EMAIL_DOMAIN}>`,
    to: email,
    subject: "Establece tu contraseña - GlowFit",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">¡Bienvenido a GlowFit!</h2>
        <p style="color: #555; margin-bottom: 24px;">Has sido invitado a formar parte de GlowFit. Haz clic en el botón para establecer tu contraseña y acceder al dashboard.</p>
        <a href="${setupLink}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-bottom: 24px;">
          Establecer contraseña
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Este link expira en <strong>24 horas</strong>. Si no esperabas este correo, ignóralo.</p>
        <p style="color: #bbb; font-size: 11px; margin-top: 16px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="color: #999; font-size: 11px; word-break: break-all;">${setupLink}</p>
      </div>
    `,
  });
};
