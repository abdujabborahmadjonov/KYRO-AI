/** Seed the demo patient. See server/seed-data.ts for the data. */
import "dotenv/config";
import { seedDemo } from "../server/seed-data.js";

seedDemo()
  .then((summary) => console.log(`✅ Seeded: ${summary}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
