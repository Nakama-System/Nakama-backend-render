// ═══════════════════════════════════════════════════════════
// Uso:
//   node scripts/hashReveal.js 3462529718
// ═══════════════════════════════════════════════════════════

const bcrypt = require("bcryptjs");

async function main() {
  const reveal = process.argv[2];
  if (!reveal) {
    console.error("❌ Pasá el número reveal como argumento: node hashReveal.js <numero>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(String(reveal), 12);

  console.log("\n✅ Hash generado:");
  console.log("─────────────────────────────────────────");
  console.log(hash);
  console.log("─────────────────────────────────────────");
  console.log("\n📋 Pegá esto en MongoDB Atlas o mongosh:");
  console.log(`\ndb.users.updateOne(\n  { email: "gjoaquinreynoso@gmail.com" },\n  { $set: { role: "superadmin", revealHash: "${hash}", sessionVersion: 0 } }\n)`);
  console.log("\n⚠️  Guardá el número original en un lugar seguro. No lo vas a poder recuperar del hash.\n");
}

main();