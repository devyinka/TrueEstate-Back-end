import "dotenv/config";
import { env } from "../config/env.js";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema.js";

const databaseUrl = env.databaseUrl;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const client = postgres(databaseUrl, {
  prepare: false,
});

export const db = drizzle(client, {
  schema,
});
