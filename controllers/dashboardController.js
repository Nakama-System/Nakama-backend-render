// ═══════════════════════════════════════════════════════════
// controllers/dashboardController.js — Nakama | Dashboard CRUD
// ═══════════════════════════════════════════════════════════

const bcrypt      = require("bcryptjs");
const crypto      = require("crypto");
const User        = require("../models/User");
const formatUser  = require("../utils/formatUser");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinaryService");
const {
  sendEmailChangeVerification,
  sendEmailChangedConfirm,
  sendPasswordChanged,
  sendAccountDeleted,
  sendProfileUpdated,
} = require("../services/emailUserDashboard");

// Almacenamiento temporal de códigos de verificación de email
// En producción usar Redis con TTL
const emailChangeCodes = new Map(); // key: userId → { code, newEmail, expiresAt }

// ─── Helper: generar código 6 dígitos ─────────────────────
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ═══════════════════════════════════════════════════════════
// GET /dashboard/me — Datos completos del usuario autenticado
// ═══════════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-password -passwordResetTokenHash -passwordResetTokenExpiry"
    );
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    const data = {
      ...formatUser(user),
      email:         user.email,
      birthDate:     user.birthDate,
      socialLinks:   user.socialLinks,
      blogUrl:       user.blogUrl,
      isOnline:      user.isOnline,
      lastSeenAt:    user.lastSeenAt,
      createdAt:     user.createdAt,
      followersCount:user.followersCount,
      followingCount:user.followingCount,
      victorias:     user.victorias,
      derrotas:      user.derrotas,
      empates:       user.empates,
      subscription:  user.subscription,
      googleLinked:  user.googleLinked,
      warningCount:  user.warningCount,
      isBanned:      user.isBanned,
      isSuspended:   user.isSuspended,
      // Admin/superadmin extra
      ...(["admin", "superadmin"].includes(req.user.role) && {
        moderationHistory: user.moderationHistory?.slice(-10),
        pendingTermsAcceptance: user.pendingTermsAcceptance,
        legalConsent:     user.legalConsent,
      }),
    };

    return res.json({ success: true, user: data });
  } catch (err) {
    console.error("[getDashboard]", err);
    return res.status(500).json({ success: false, message: "Error al obtener datos." });
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /dashboard/profile — Actualizar nombre, bio, links
// ═══════════════════════════════════════════════════════════
exports.updateProfile = async (req, res) => {
  try {
    const { displayName, bio, blogUrl, socialLinks } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    const changes = {};

    if (displayName !== undefined) {
      const trimmed = String(displayName).trim().slice(0, 50);
      if (trimmed !== user.displayName) {
        changes["Nombre"] = `${user.displayName || "(vacío)"} → ${trimmed}`;
        user.displayName = trimmed;
      }
    }

    if (bio !== undefined) {
      const trimmed = String(bio).trim().slice(0, 300);
      if (trimmed !== user.bio) {
        changes["Bio"] = trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;
        user.bio = trimmed;
      }
    }

    if (blogUrl !== undefined) {
      user.blogUrl = String(blogUrl).trim().slice(0, 200);
    }

    if (socialLinks && typeof socialLinks === "object") {
      user.socialLinks = {
        instagram: String(socialLinks.instagram || "").trim().slice(0, 100),
        tiktok:    String(socialLinks.tiktok    || "").trim().slice(0, 100),
        facebook:  String(socialLinks.facebook  || "").trim().slice(0, 100),
      };
    }

    await user.save();

    // Enviar email de confirmación si hay cambios relevantes
    if (Object.keys(changes).length > 0) {
      sendProfileUpdated(user.email, user.username, changes).catch(console.error);
    }

    return res.json({ success: true, message: "Perfil actualizado.", user: formatUser(user) });
  } catch (err) {
    console.error("[updateProfile]", err);
    return res.status(500).json({ success: false, message: "Error al actualizar perfil." });
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /dashboard/avatar — Subir nuevo avatar
// ═══════════════════════════════════════════════════════════
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No se recibió archivo." });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    // Eliminar avatar anterior de Cloudinary
    if (user.avatarPublicId) {
      deleteFromCloudinary(user.avatarPublicId, "image").catch(console.error);
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "nakama/avatars",
      resource_type: "image",
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });

    user.avatarUrl      = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save();

    return res.json({ success: true, message: "Avatar actualizado.", avatarUrl: user.avatarUrl });
  } catch (err) {
    console.error("[updateAvatar]", err);
    return res.status(500).json({ success: false, message: "Error al subir avatar." });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /dashboard/avatar — Eliminar avatar (volver al default)
// ═══════════════════════════════════════════════════════════
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    if (user.avatarPublicId) {
      deleteFromCloudinary(user.avatarPublicId, "image").catch(console.error);
    }

    user.avatarUrl      = "";
    user.avatarPublicId = "";
    await user.save();

    return res.json({ success: true, message: "Avatar eliminado." });
  } catch (err) {
    console.error("[deleteAvatar]", err);
    return res.status(500).json({ success: false, message: "Error al eliminar avatar." });
  }
};

// ═══════════════════════════════════════════════════════════
// POST /dashboard/email/request — Solicitar cambio de email
// Envía código al email ACTUAL para verificar identidad
// ═══════════════════════════════════════════════════════════
exports.requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
      return res.status(400).json({ success: false, message: "Email inválido." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    if (newEmail.toLowerCase() === user.email) {
      return res.status(400).json({ success: false, message: "El email es igual al actual." });
    }

    const existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Ese email ya está registrado." });
    }

    const code      = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    emailChangeCodes.set(user._id.toString(), { code, newEmail: newEmail.toLowerCase(), expiresAt });

    await sendEmailChangeVerification(user.email, user.username, code, newEmail);

    return res.json({ success: true, message: `Código enviado a tu email actual (${user.email}). Ingresalo para confirmar.` });
  } catch (err) {
    console.error("[requestEmailChange]", err);
    return res.status(500).json({ success: false, message: "Error al solicitar cambio de email." });
  }
};

// ═══════════════════════════════════════════════════════════
// POST /dashboard/email/confirm — Confirmar código y cambiar email
// ═══════════════════════════════════════════════════════════
exports.confirmEmailChange = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Código requerido." });

    const pending = emailChangeCodes.get(req.user.id.toString());
    if (!pending) {
      return res.status(400).json({ success: false, message: "No hay un cambio de email pendiente. Solicitá uno nuevo." });
    }

    if (new Date() > pending.expiresAt) {
      emailChangeCodes.delete(req.user.id.toString());
      return res.status(400).json({ success: false, message: "El código expiró. Solicitá uno nuevo." });
    }

    if (pending.code !== code.trim()) {
      return res.status(400).json({ success: false, message: "Código incorrecto." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    const oldEmail = user.email;

    await User.updateOne({ _id: user._id }, { $set: { email: pending.newEmail } });
    emailChangeCodes.delete(user._id.toString());

    // Notificar a ambos emails
    sendEmailChangedConfirm(pending.newEmail, user.username, oldEmail, pending.newEmail).catch(console.error);

    return res.json({ success: true, message: "Email actualizado correctamente.", email: pending.newEmail });
  } catch (err) {
    console.error("[confirmEmailChange]", err);
    return res.status(500).json({ success: false, message: "Error al confirmar email." });
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /dashboard/password — Cambiar contraseña
// ═══════════════════════════════════════════════════════════
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Completá todos los campos." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 8 caracteres." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    // Usuarios con Google sin contraseña configurada
    if (!user.password) {
      return res.status(400).json({ success: false, message: "Tu cuenta usa Google. Establecé una contraseña desde recuperar contraseña." });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ success: false, message: "La contraseña actual es incorrecta." });

    user.password = newPassword;
    user.sessionVersion = (user.sessionVersion || 0) + 1; // invalidar sesiones anteriores
    await user.save();

    sendPasswordChanged(user.email, user.username).catch(console.error);

    return res.json({ success: true, message: "Contraseña actualizada. Tus otras sesiones fueron cerradas." });
  } catch (err) {
    console.error("[updatePassword]", err);
    return res.status(500).json({ success: false, message: "Error al actualizar contraseña." });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /dashboard/account — Eliminar cuenta propia
// ═══════════════════════════════════════════════════════════
exports.deleteAccount = async (req, res) => {
  try {
    const { password, keepNotifications = false } = req.body;

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado." });

    // Verificar contraseña (si tiene)
    if (user.password) {
      if (!password) return res.status(400).json({ success: false, message: "Ingresá tu contraseña para confirmar." });
      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ success: false, message: "Contraseña incorrecta." });
    }

    const { email, username, avatarPublicId, profileVideo } = user;

    // Limpiar archivos de Cloudinary
    if (avatarPublicId) deleteFromCloudinary(avatarPublicId, "image").catch(console.error);
    if (profileVideo?.publicId) deleteFromCloudinary(profileVideo.publicId, "video").catch(console.error);

    // Enviar email de despedida ANTES de eliminar
    await sendAccountDeleted(email, username, !!keepNotifications);

    // Si quiere conservar email para notificaciones, guardarlo aparte
    // (aquí podrías insertarlo en una colección "newsletterList" si la tenés)

    await User.deleteOne({ _id: user._id });

    res.clearCookie("nakama_refresh");
    return res.json({ success: true, message: "Tu cuenta fue eliminada permanentemente. ¡Hasta pronto!" });
  } catch (err) {
    console.error("[deleteAccount]", err);
    return res.status(500).json({ success: false, message: "Error al eliminar la cuenta." });
  }
};

// ═══════════════════════════════════════════════════════════
// PATCH /dashboard/username — Cambiar username
// ═══════════════════════════════════════════════════════════
exports.updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Username debe tener al menos 3 caracteres." });
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username.trim())) {
      return res.status(400).json({ success: false, message: "Solo letras, números, puntos y guiones bajos." });
    }

    const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.user.id } });
    if (taken) return res.status(409).json({ success: false, message: "Ese username ya está en uso." });

    await User.updateOne({ _id: req.user.id }, { $set: { username: username.trim() } });

    return res.json({ success: true, message: "Username actualizado.", username: username.trim() });
  } catch (err) {
    console.error("[updateUsername]", err);
    return res.status(500).json({ success: false, message: "Error al actualizar username." });
  }
};