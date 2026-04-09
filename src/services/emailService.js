import { Resend } from "resend";

let _resend = null;
const getResend = () => {
  if (!_resend) _resend = new Resend(process.env.RESEND_KEY);
  return _resend;
};

export const sendPasswordResetCode = async (email, code) => {
  await getResend().emails.send({
    from: "GlowFit <onboarding@resend.dev>",
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
