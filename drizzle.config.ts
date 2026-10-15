import { config } from "dotenv";
config({ path: ".env" }); // Explicitly forces dotenv to look in the current folder

console.log(
  "CHECKING ENV: ",
  process.env.DATABASE_URL ? "URL FOUND!" : "URL IS UNDEFINED!",
);

import { defineConfig } from "drizzle-kit";

const DatabaseURL = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DatabaseURL!,
  },
  strict: true,
  verbose: true,
});
