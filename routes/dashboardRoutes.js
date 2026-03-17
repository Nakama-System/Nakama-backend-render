// ═══════════════════════════════════════════════════════════
// routes/dashboardRoutes.js — Nakama | Dashboard
// ═══════════════════════════════════════════════════════════

const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const { protect } = require("../middlewares/authMiddleware"); // tu middleware JWT
const ctrl        = require("../controllers/dashboardController");

// Multer en memoria para avatar
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max para avatar
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo imágenes JPG, PNG, WebP o GIF."));
  },
});

// ─── Rutas protegidas (requieren JWT) ─────────────────────

// Datos del dashboard
router.get("/me", protect, ctrl.getDashboard);

// Perfil (nombre, bio, links)
router.patch("/profile",  protect, ctrl.updateProfile);
router.patch("/username", protect, ctrl.updateUsername);

// Avatar
router.patch("/avatar", protect, upload.single("avatar"), ctrl.updateAvatar);
router.delete("/avatar", protect, ctrl.deleteAvatar);

// Email (flujo de 2 pasos)
router.post("/email/request", protect, ctrl.requestEmailChange);
router.post("/email/confirm", protect, ctrl.confirmEmailChange);

// Contraseña
router.patch("/password", protect, ctrl.updatePassword);

// Eliminar cuenta
router.delete("/account", protect, ctrl.deleteAccount);

module.exports = router;

// ─── En index.js agregar: ──────────────────────────────────
// const dashboardRoutes = require("./routes/dashboardRoutes");
// app.use("/dashboard", dashboardRoutes);