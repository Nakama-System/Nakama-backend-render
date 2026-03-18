// ═══════════════════════════════════════════════════════════
// routes/questionRoutes.js — Nakama
// ═══════════════════════════════════════════════════════════

const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const os       = require("os");

const { protect }                            = require("../middlewares/authMiddleware");
const {
  uploadQuestions,
  getQuestions,
  getByCategoria,
  getRandomQuestions,
  updateQuestion,
  deleteQuestion,
  createQuestion,
} = require("../controllers/questionController");

// ─── Multer: almacena en /tmp con validación de tipo ─────
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máx
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const validExts  = [".docx", ".doc"];
    const validMimes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/octet-stream",
    ];
    if (validExts.includes(ext) || validMimes.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan archivos .docx o .doc"), false);
    }
  },
});

// ─── Middleware solo para admin/superadmin ────────────────
function adminOnly(req, res, next) {
  const role = req.user?.role;
  if (!["admin", "superadmin"].includes(role)) {
    return res.status(403).json({ message: "Solo administradores pueden gestionar preguntas" });
  }
  next();
}

// ─────────────────────────────────────────────────────────
// Rutas públicas (autenticadas)
// ─────────────────────────────────────────────────────────
router.use(protect);

// Obtener preguntas aleatorias para el juego
// GET /questions/random?categorias=shonen,isekai&count=10
router.get("/random",        getRandomQuestions);

// Agrupar por categoría (para mostrar stats)
// GET /questions/by-categoria
router.get("/by-categoria",  getByCategoria);

// ─────────────────────────────────────────────────────────
// Rutas de admin
// ─────────────────────────────────────────────────────────
router.use(adminOnly);

// GET /questions?categoria=shonen&activa=true&page=1&limit=50
router.get("/",              getQuestions);

// POST /questions  — crear manual
router.post("/",             createQuestion);

// POST /questions/upload  — subir Word
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("word")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Error de carga: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadQuestions
);

// PATCH /questions/:id
router.patch("/:id",         updateQuestion);

// DELETE /questions/:id
router.delete("/:id",        deleteQuestion);

module.exports = router;