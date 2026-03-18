// ═══════════════════════════════════════════════════════════
// controllers/questionController.js — Nakama
// ═══════════════════════════════════════════════════════════

const Question = require("../models/Question");
const path     = require("path");
const fs       = require("fs");
const mammoth  = require("mammoth");
const { v4: uuidv4 } = require("uuid");

const VALID_CATEGORIAS = [
  "shonen", "seinen", "isekai", "romance", "mecha",
  "clasico", "actual", "peliculas", "personajes", "opening",
];

// ─────────────────────────────────────────────────────────
// Parsear el texto extraído del Word
// Formato esperado por pregunta:
//
//   Pregunta N  [CATEGORIA: xxx]
//   Pregunta: texto de la pregunta
//   A) opción A
//   B) opción B
//   C) opción C
//   D) opción D
//   CORRECTA: A   (o B, C, D)
//
// ─────────────────────────────────────────────────────────
function parseQuestionsFromText(text) {
  const questions = [];
  const errors    = [];

  // Dividir por bloques de pregunta: busca "Pregunta N" seguido de categoria
  // Soporta también sin el bloque [CATEGORIA] para flexibilidad
  const blocks = text
    .split(/\n(?=Pregunta\s+\d+)/gi)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    try {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 7) continue; // bloque incompleto

      // Línea 0: "Pregunta N  [CATEGORIA: xxx]"
      const headerLine = lines[0];
      const numMatch   = headerLine.match(/Pregunta\s+(\d+)/i);
      if (!numMatch) continue;
      const num = parseInt(numMatch[1]);

      // Extraer categoría del header o de línea separada
      let categoria = null;
      const catMatch = headerLine.match(/\[CATEGORIA:\s*([^\]]+)\]/i);
      if (catMatch) {
        categoria = catMatch[1].trim().toLowerCase();
      } else {
        // buscar línea que tenga solo la categoria
        for (const l of lines) {
          const m = l.match(/^\[?CATEGORIA:?\s*([a-z]+)\]?$/i);
          if (m) { categoria = m[1].trim().toLowerCase(); break; }
        }
      }

      if (!categoria || !VALID_CATEGORIAS.includes(categoria)) {
        errors.push(`Pregunta ${num}: categoría inválida o no encontrada ("${categoria}")`);
        continue;
      }

      // Línea con "Pregunta:" — el enunciado
      const textLine = lines.find((l) => /^pregunta:/i.test(l));
      if (!textLine) {
        errors.push(`Pregunta ${num}: no se encontró el enunciado (línea "Pregunta:")`);
        continue;
      }
      const texto = textLine.replace(/^pregunta:\s*/i, "").trim();
      if (!texto || texto.length < 5) {
        errors.push(`Pregunta ${num}: enunciado muy corto o vacío`);
        continue;
      }

      // Opciones A B C D
      const opciones = [];
      const letras   = ["A", "B", "C", "D"];
      for (const letra of letras) {
        const optLine = lines.find((l) =>
          new RegExp(`^${letra}[)\\.]`, "i").test(l)
        );
        if (!optLine) {
          errors.push(`Pregunta ${num}: falta opción ${letra}`);
          break;
        }
        opciones.push(optLine.replace(new RegExp(`^${letra}[).]\s*`, "i"), "").trim());
      }
      if (opciones.length !== 4) continue;

      // Respuesta correcta
      const correctaLine = lines.find((l) => /^CORRECTA:/i.test(l));
      if (!correctaLine) {
        errors.push(`Pregunta ${num}: no se encontró la línea CORRECTA:`);
        continue;
      }
      const correctaLetra = correctaLine
        .replace(/^CORRECTA:\s*/i, "")
        .trim()
        .toUpperCase()
        .charAt(0);

      const correctaIdx = letras.indexOf(correctaLetra);
      if (correctaIdx === -1) {
        errors.push(`Pregunta ${num}: valor CORRECTA inválido ("${correctaLetra}")`);
        continue;
      }

      questions.push({
        id:       `q_${uuidv4().slice(0, 8)}`,
        texto,
        opciones,
        correcta: correctaIdx,
        categoria,
      });
    } catch (err) {
      errors.push(`Error parseando bloque: ${err.message}`);
    }
  }

  return { questions, errors };
}

// ════════════════════════════════════════════════════════════
// POST /questions/upload   — sube un .docx, parsea y guarda
// Solo admin / superadmin (protegido en ruta)
// ════════════════════════════════════════════════════════════
exports.uploadQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }

    const filePath = req.file.path;

    // Extraer texto plano del docx con mammoth
    let rawText;
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      rawText = result.value;
    } finally {
      // Limpiar el archivo temporal siempre
      try { fs.unlinkSync(filePath); } catch (_) {}
    }

    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ message: "El documento está vacío o no se pudo leer" });
    }

    const { questions, errors } = parseQuestionsFromText(rawText);

    if (questions.length === 0) {
      return res.status(400).json({
        message: "No se encontraron preguntas válidas en el documento",
        errors,
        rawPreview: rawText.slice(0, 500),
      });
    }

    // Guardar en BD (upsert por id para evitar duplicados si se re-sube)
    const userId = req.user?._id ?? req.user?.id ?? null;
    const saved = [];
    const skipped = [];

    for (const q of questions) {
      try {
        const doc = await Question.findOneAndUpdate(
          { id: q.id },
          {
            $set: {
              texto:      q.texto,
              opciones:   q.opciones,
              correcta:   q.correcta,
              categoria:  q.categoria,
              uploadedBy: userId,
              activa:     true,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );
        saved.push({ id: doc.id, categoria: doc.categoria, texto: doc.texto.slice(0, 60) });
      } catch (err) {
        skipped.push({ texto: q.texto.slice(0, 60), error: err.message });
      }
    }

    res.status(201).json({
      ok:      true,
      saved:   saved.length,
      skipped: skipped.length,
      errors:  [...errors, ...skipped.map((s) => `Omitida: ${s.texto} — ${s.error}`)],
      questions: saved,
    });
  } catch (err) {
    console.error("[uploadQuestions]", err);
    res.status(500).json({ message: "Error procesando el documento", detail: err.message });
  }
};

// ════════════════════════════════════════════════════════════
// GET /questions   — listar con filtros
// ════════════════════════════════════════════════════════════
exports.getQuestions = async (req, res) => {
  try {
    const { categoria, activa, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (categoria) filter.categoria = categoria;
    if (activa !== undefined) filter.activa = activa === "true";

    const total = await Question.countDocuments(filter);
    const docs  = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ total, page: Number(page), limit: Number(limit), questions: docs });
  } catch (err) {
    console.error("[getQuestions]", err);
    res.status(500).json({ message: "Error al obtener preguntas" });
  }
};

// ════════════════════════════════════════════════════════════
// GET /questions/by-categoria   — agrupar por categoría
// ════════════════════════════════════════════════════════════
exports.getByCategoria = async (req, res) => {
  try {
    const agg = await Question.aggregate([
      { $match: { activa: true } },
      { $group: { _id: "$categoria", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(agg);
  } catch (err) {
    res.status(500).json({ message: "Error al agrupar por categoría" });
  }
};

// ════════════════════════════════════════════════════════════
// GET /questions/random   — N preguntas aleatorias por categorías
// Query params: categorias (comma-separated), count (default 10)
// ════════════════════════════════════════════════════════════
exports.getRandomQuestions = async (req, res) => {
  try {
    const { categorias, count = 10 } = req.query;
    const n = Math.min(Math.max(parseInt(count) || 10, 1), 30);

    const filter = { activa: true };
    if (categorias) {
      const cats = categorias.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
      if (cats.length > 0) filter.categoria = { $in: cats };
    }

    const questions = await Question.aggregate([
      { $match: filter },
      { $sample: { size: n } },
      { $project: { _id: 0, id: 1, texto: 1, opciones: 1, correcta: 1, categoria: 1 } },
    ]);

    // Si no hay suficientes de las categorías pedidas, completar con cualquiera
    if (questions.length < n) {
      const ids     = questions.map((q) => q.id);
      const missing = n - questions.length;
      const extra   = await Question.aggregate([
        { $match: { activa: true, id: { $nin: ids } } },
        { $sample: { size: missing } },
        { $project: { _id: 0, id: 1, texto: 1, opciones: 1, correcta: 1, categoria: 1 } },
      ]);
      questions.push(...extra);
    }

    res.json({ questions, total: questions.length });
  } catch (err) {
    console.error("[getRandomQuestions]", err);
    res.status(500).json({ message: "Error al obtener preguntas aleatorias" });
  }
};

// ════════════════════════════════════════════════════════════
// PATCH /questions/:id   — editar una pregunta
// ════════════════════════════════════════════════════════════
exports.updateQuestion = async (req, res) => {
  try {
    const { texto, opciones, correcta, categoria, activa } = req.body;
    const updates = {};
    if (texto     !== undefined) updates.texto     = texto;
    if (opciones  !== undefined) updates.opciones  = opciones;
    if (correcta  !== undefined) updates.correcta  = correcta;
    if (categoria !== undefined) updates.categoria = categoria;
    if (activa    !== undefined) updates.activa    = activa;

    const doc = await Question.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: "Pregunta no encontrada" });
    res.json({ ok: true, question: doc });
  } catch (err) {
    console.error("[updateQuestion]", err);
    res.status(500).json({ message: "Error al actualizar pregunta" });
  }
};

// ════════════════════════════════════════════════════════════
// DELETE /questions/:id
// ════════════════════════════════════════════════════════════
exports.deleteQuestion = async (req, res) => {
  try {
    const doc = await Question.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Pregunta no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar pregunta" });
  }
};

// ════════════════════════════════════════════════════════════
// POST /questions   — crear una pregunta manual
// ════════════════════════════════════════════════════════════
exports.createQuestion = async (req, res) => {
  try {
    const { texto, opciones, correcta, categoria } = req.body;
    if (!texto || !opciones || correcta === undefined || !categoria) {
      return res.status(400).json({ message: "Faltan campos requeridos: texto, opciones, correcta, categoria" });
    }
    const userId = req.user?._id ?? req.user?.id ?? null;
    const doc = await Question.create({
      id:         `q_${uuidv4().slice(0, 8)}`,
      texto,
      opciones,
      correcta,
      categoria,
      uploadedBy: userId,
    });
    res.status(201).json({ ok: true, question: doc });
  } catch (err) {
    console.error("[createQuestion]", err);
    res.status(500).json({ message: "Error al crear pregunta", detail: err.message });
  }
};