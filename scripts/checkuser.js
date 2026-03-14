require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

mongoose.connect("mongodb+srv://nakama:nakama@cluster0.mhb1nsr.mongodb.net/?appName=Cluster0").then(async () => {
  const hash = await bcrypt.hash("3462529718", 12);
  
  await mongoose.connection.db.collection("users").updateOne(
    { email: "gjoaquinreynoso@gmail.com" },
    { $set: { revealHash: hash, role: "superadmin", sessionVersion: 0 },
      $unset: { reveal: "" }  // eliminar el campo viejo
    }
  );

  const user = await mongoose.connection.db.collection("users").findOne(
    { email: "gjoaquinreynoso@gmail.com" },
    { projection: { email: 1, role: 1, revealHash: 1, sessionVersion: 1 } }
  );
  console.log(JSON.stringify(user, null, 2));
  process.exit(0);
});