import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  console.log("⏳ Connecting to database...");
  
  // Use max: 1 for migrations
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("🚀 Applying migrations...");
  
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log("✅ Migrations applied successfully!");
  await migrationClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed!");
  console.error(err);
  process.exit(1);
});