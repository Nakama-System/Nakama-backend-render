// ═══════════════════════════════════════════════════════════
// scripts/migrateBattleStats.js
// Uso: node scripts/migrateBattleStats.js
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://nakama:nakama@cluster0.mhb1nsr.mongodb.net/?appName=Cluster0";

async function migrate() {
  console.log("🔌 Conectando a MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Conectado");

  const result = await mongoose.connection.collection("users").updateMany(
    {
      $or: [
        { victorias: { $exists: false } },
        { derrotas:  { $exists: false } },
        { empates:   { $exists: false } },
      ],
    },
    {
      $set: {
        victorias: 0,
        derrotas:  0,
        empates:   0,
      },
    }
  );

  console.log(`✅ Migración completa — ${result.modifiedCount} usuarios actualizados`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error("❌ Error en migración:", err);
  process.exit(1);
});