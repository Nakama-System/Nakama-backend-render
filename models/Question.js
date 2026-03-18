// ═══════════════════════════════════════════════════════════
// models/Question.js — Nakama
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    // ID único de la pregunta (para referencia en el juego)
    id: { type: String, required: true, unique: true },

    // Texto de la pregunta
    texto: { type: String, required: true, trim: true, maxlength: 500 },

    // Cuatro opciones de respuesta [A, B, C, D]
    opciones: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.length === 4,
        message: "Debe haber exactamente 4 opciones",
      },
    },

    // Índice de la opción correcta (0=A, 1=B, 2=C, 3=D)
    correcta: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },

    // Categoría de la pregunta
    categoria: {
      type: String,
      required: true,
      enum: [
        "shonen", "seinen", "isekai", "romance", "mecha",
        "clasico", "actual", "peliculas", "personajes", "opening",
      ],
    },

    // Quién subió esta pregunta
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Activa / inactiva (para poder desactivar sin borrar)
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

questionSchema.index({ categoria: 1, activa: 1 });
questionSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model("Question", questionSchema);