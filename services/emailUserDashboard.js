// ═══════════════════════════════════════════════════════════
// services/emailUserDashboard.js — Nakama | Dashboard Emails
// ═══════════════════════════════════════════════════════════

const nodemailer = require("nodemailer");
require("dotenv").config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let _transport = null;

async function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  await _transport.verify();
  console.log("📬  [emailDashboard] Gmail listo.");
  return _transport;
}

// ─── Paleta y estilos compartidos ─────────────────────────
const SHARED_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#06060f; font-family:'Segoe UI', Arial, sans-serif; color:#e2e2f0; }
  .wrapper { max-width:540px; margin:0 auto; padding:48px 20px; }
  .card {
    background: linear-gradient(160deg, #0d0d1f 0%, #0a0a18 100%);
    border: 1px solid rgba(230,57,70,0.18);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(230,57,70,0.08), 0 20px 40px rgba(0,0,0,0.5);
  }
  .card-header {
    position: relative;
    padding: 36px 36px 28px;
    background: linear-gradient(135deg, #12021e 0%, #1a0210 50%, #0d0d1f 100%);
    border-bottom: 1px solid rgba(230,57,70,0.12);
    text-align: center;
  }
  .card-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.15) 0%, transparent 70%);
  }
  .logo-text {
    position: relative;
    font-size: 1.3rem;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: #e63946;
    text-shadow: 0 0 20px rgba(230,57,70,0.5);
    display: block;
    margin-bottom: 16px;
  }
  .header-icon { position: relative; font-size: 2.6rem; display: block; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(230,57,70,0.6)); }
  .header-title { position: relative; font-size: 1.4rem; font-weight: 800; color: #f0f0fa; margin-bottom: 6px; }
  .header-subtitle { position: relative; font-size: 0.9rem; color: #6b6b8e; line-height: 1.5; }
  .card-body { padding: 36px; }
  .greeting { font-size: 0.95rem; color: #9090b8; margin-bottom: 24px; line-height: 1.7; }
  .greeting strong { color: #e2e2f0; }
  .info-box { background: rgba(76,201,240,0.05); border: 1px solid rgba(76,201,240,0.12); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
  .info-label { font-size: 0.72rem; color: #4cc9f0; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .info-value { font-size: 0.95rem; color: #e2e2f0; font-weight: 600; word-break: break-all; }
  .cta-wrap { text-align: center; margin: 28px 0; }
  .cta-btn {
    display: inline-block; padding: 14px 44px;
    background: linear-gradient(135deg, #e63946, #c1121f);
    color: #fff !important; text-decoration: none;
    font-size: 0.95rem; font-weight: 700; letter-spacing: 0.05em;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(230,57,70,0.4), 0 0 0 1px rgba(230,57,70,0.3);
  }
  .warning-box {
    display: flex; gap: 12px; align-items: flex-start;
    background: rgba(255,209,102,0.06); border: 1px solid rgba(255,209,102,0.15);
    border-radius: 10px; padding: 14px 16px; margin: 24px 0 0;
  }
  .warning-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
  .warning-text { font-size: 0.82rem; color: #c9a227; line-height: 1.6; }
  .card-footer { padding: 20px 36px; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.2); }
  .footer-text { font-size: 0.75rem; color: #3a3a58; text-align: center; line-height: 1.7; }
  .footer-kanji { display: block; font-size: 1.1rem; color: rgba(230,57,70,0.2); margin-top: 8px; text-align: center; }
  .divider { height: 1px; background: rgba(76,201,240,0.07); margin: 20px 0; }
  .code-box { display:inline-flex; gap:8px; background:#050508; border:2px solid rgba(230,57,70,0.4); border-radius:12px; padding:16px 24px; margin: 20px auto; box-shadow:0 0 30px rgba(230,57,70,0.15); }
  .code-digit { font-family:monospace; font-size:2rem; font-weight:900; color:#e63946; min-width:32px; text-align:center; }
`;

function baseLayout({ icon, title, subtitle, body, year }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — Nakama</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="card-header">
        <span class="logo-text">⚔ NAKAMA</span>
        <span class="header-icon">${icon}</span>
        <h1 class="header-title">${title}</h1>
        <p class="header-subtitle">${subtitle}</p>
      </div>
      <div class="card-body">${body}</div>
      <div class="card-footer">
        <p class="footer-text">© ${year} Nakama — Anime · Gamer · Cultura Geek</p>
        <span class="footer-kanji">仲間</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
// 1. Verificación de nuevo email (antes de cambiarlo)
// ═══════════════════════════════════════════════════════════
function emailChangeVerificationHTML(username, code, newEmail) {
  const digits = code.split("").map(d => `<span class="code-digit">${d}</span>`).join("");
  const body = `
    <p class="greeting">Hola, <strong>${username}</strong> 👋<br/><br/>
      Recibimos una solicitud para cambiar el email de tu cuenta Nakama a <strong>${newEmail}</strong>.<br/>
      Usá este código para confirmar el cambio. <strong>Expira en 10 minutos.</strong>
    </p>
    <div style="text-align:center">
      <div class="code-box">${digits}</div>
    </div>
    <div class="warning-box">
      <span class="warning-icon">⚠️</span>
      <p class="warning-text">
        Si no solicitaste este cambio, tu cuenta podría estar comprometida. 
        Cambiá tu contraseña de inmediato y contactá soporte.
      </p>
    </div>`;
  return baseLayout({ icon: "✉️", title: "Confirmá el cambio de email", subtitle: `Verificación requerida para <strong>${username}</strong>`, body, year: new Date().getFullYear() });
}

// ═══════════════════════════════════════════════════════════
// 2. Confirmación — email cambiado exitosamente
// ═══════════════════════════════════════════════════════════
function emailChangedConfirmHTML(username, oldEmail, newEmail) {
  const body = `
    <p class="greeting">Hola, <strong>${username}</strong> 👋<br/><br/>
      Te confirmamos que el email de tu cuenta fue actualizado correctamente.
    </p>
    <div class="info-box">
      <p class="info-label">Email anterior</p>
      <p class="info-value">${oldEmail}</p>
    </div>
    <div class="info-box">
      <p class="info-label">Email nuevo</p>
      <p class="info-value" style="color:#4cc9f0">${newEmail}</p>
    </div>
    <div class="warning-box">
      <span class="warning-icon">⚠️</span>
      <p class="warning-text">
        Si no realizaste este cambio, contactá a soporte de inmediato en support@nakama.app
      </p>
    </div>`;
  return baseLayout({ icon: "✅", title: "Email actualizado", subtitle: "Tu dirección de email fue cambiada con éxito", body, year: new Date().getFullYear() });
}

// ═══════════════════════════════════════════════════════════
// 3. Confirmación — contraseña cambiada
// ═══════════════════════════════════════════════════════════
function passwordChangedHTML(username) {
  const body = `
    <p class="greeting">Hola, <strong>${username}</strong> 👋<br/><br/>
      Tu contraseña fue actualizada exitosamente desde el panel de configuración.
    </p>
    <div class="warning-box">
      <span class="warning-icon">⚠️</span>
      <p class="warning-text">
        Si no realizaste este cambio, restablecé tu contraseña de inmediato.<br/>
        Nadie de Nakama te pedirá tu contraseña por email.
      </p>
    </div>`;
  return baseLayout({ icon: "🔐", title: "Contraseña actualizada", subtitle: "Cambio de contraseña confirmado", body, year: new Date().getFullYear() });
}

// ═══════════════════════════════════════════════════════════
// 4. Aviso de eliminación de cuenta (con opción de conservar email)
// ═══════════════════════════════════════════════════════════
function accountDeletedHTML(username, keepNotifications) {
  const notifMsg = keepNotifications
    ? `<div class="info-box" style="border-color:rgba(76,201,240,0.2)">
        <p class="info-label" style="color:#4cc9f0">Preferencia guardada</p>
        <p class="info-value" style="font-size:0.9rem;font-weight:400;color:#9090b8">
          Conservaremos tu email para enviarte novedades, eventos especiales y reactivaciones de Nakama. 
          Podés darte de baja en cualquier momento respondiendo este email con "BAJA".
        </p>
       </div>`
    : `<div class="info-box">
        <p class="info-label">Preferencia guardada</p>
        <p class="info-value" style="font-size:0.9rem;font-weight:400;color:#9090b8">
          Respetamos tu decisión. No recibirás más comunicaciones de nuestra parte.
        </p>
       </div>`;
  const body = `
    <p class="greeting">Hola, <strong>${username}</strong> 👋<br/><br/>
      Tu cuenta de Nakama ha sido eliminada. Todos tus datos personales, 
      publicaciones y contenido han sido borrados de nuestros servidores.
    </p>
    ${notifMsg}
    <div class="warning-box">
      <span class="warning-icon">💔</span>
      <p class="warning-text">
        Lamentamos verte partir. Si cambiás de opinión, siempre podés crear una nueva cuenta 
        en nakama.app. ¡El equipo Nakama te espera!
      </p>
    </div>`;
  return baseLayout({ icon: "🗑️", title: "Cuenta eliminada", subtitle: "Tu cuenta Nakama fue eliminada permanentemente", body, year: new Date().getFullYear() });
}

// ═══════════════════════════════════════════════════════════
// 5. Perfil actualizado (nombre, avatar, bio)
// ═══════════════════════════════════════════════════════════
function profileUpdatedHTML(username, changes) {
  const changeRows = Object.entries(changes)
    .map(([k, v]) => `<div class="info-box" style="margin:10px 0">
      <p class="info-label">${k}</p>
      <p class="info-value">${v}</p>
    </div>`).join("");
  const body = `
    <p class="greeting">Hola, <strong>${username}</strong> 👋<br/><br/>
      Tu perfil fue actualizado con los siguientes cambios:
    </p>
    ${changeRows}
    <p style="font-size:0.8rem;color:#55557a;margin-top:16px;line-height:1.6">
      Si no reconocés estos cambios, asegurate de que tu cuenta esté protegida y contactá soporte.
    </p>`;
  return baseLayout({ icon: "✏️", title: "Perfil actualizado", subtitle: "Resumen de cambios en tu cuenta", body, year: new Date().getFullYear() });
}

// ═══════════════════════════════════════════════════════════
// Funciones de envío
// ═══════════════════════════════════════════════════════════

async function sendEmailChangeVerification(to, username, code, newEmail) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from:    '"Nakama 🎌" <' + EMAIL_USER + '>',
    to,
    subject: `${code} — Confirmá el cambio de email en Nakama`,
    text:    `Hola ${username}! Tu código para cambiar el email a ${newEmail} es: ${code}. Expira en 10 minutos.`,
    html:    emailChangeVerificationHTML(username, code, newEmail),
  });
  console.log(`📬 [emailDashboard] Verificación cambio email → ${to} | ${info.messageId}`);
  return info;
}

async function sendEmailChangedConfirm(to, username, oldEmail, newEmail) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from:    '"Nakama 🎌" <' + EMAIL_USER + '>',
    to:      [to, oldEmail].filter(Boolean),
    subject: `Tu email de Nakama fue actualizado`,
    text:    `Hola ${username}! Tu email fue cambiado de ${oldEmail} a ${newEmail}.`,
    html:    emailChangedConfirmHTML(username, oldEmail, newEmail),
  });
  console.log(`📬 [emailDashboard] Confirmación cambio email → ${to} | ${info.messageId}`);
  return info;
}

async function sendPasswordChanged(to, username) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from:    '"Nakama 🎌" <' + EMAIL_USER + '>',
    to,
    subject: `Tu contraseña de Nakama fue actualizada`,
    text:    `Hola ${username}! Tu contraseña fue cambiada exitosamente.`,
    html:    passwordChangedHTML(username),
  });
  console.log(`📬 [emailDashboard] Password changed → ${to} | ${info.messageId}`);
  return info;
}

async function sendAccountDeleted(to, username, keepNotifications) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from:    '"Nakama 🎌" <' + EMAIL_USER + '>',
    to,
    subject: `Tu cuenta de Nakama fue eliminada`,
    text:    `Hola ${username}! Tu cuenta fue eliminada. ${keepNotifications ? "Conservaremos tu email para futuras novedades." : "No recibirás más emails nuestros."}`,
    html:    accountDeletedHTML(username, keepNotifications),
  });
  console.log(`📬 [emailDashboard] Account deleted → ${to} | ${info.messageId}`);
  return info;
}

async function sendProfileUpdated(to, username, changes) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from:    '"Nakama 🎌" <' + EMAIL_USER + '>',
    to,
    subject: `Tu perfil de Nakama fue actualizado`,
    text:    `Hola ${username}! Tu perfil fue actualizado.`,
    html:    profileUpdatedHTML(username, changes),
  });
  console.log(`📬 [emailDashboard] Profile updated → ${to} | ${info.messageId}`);
  return info;
}

module.exports = {
  sendEmailChangeVerification,
  sendEmailChangedConfirm,
  sendPasswordChanged,
  sendAccountDeleted,
  sendProfileUpdated,
};