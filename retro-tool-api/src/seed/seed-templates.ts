/**
 * Production-safe template seeding script.
 * Seeds all built-in templates — idempotent and safe to run in any environment.
 *
 * Run locally:  pnpm db:seed:templates
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { template, templateColumn } from '../retros/schema';
import { BUILT_IN_TEMPLATES } from '../common/data/built-in-templates';

async function seedTemplates() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log('Seeding built-in templates...');

  // Fetch existing template IDs to skip already-seeded templates
  const existing = await db
    .select({ id: template.id, name: template.name })
    .from(template);
  const existingIds = new Set(existing.map((t) => t.id));
  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

  let added = 0;

  for (const tmpl of BUILT_IN_TEMPLATES) {
    if (
      existingIds.has(tmpl.id) ||
      existingNames.has(tmpl.name.toLowerCase())
    ) {
      continue;
    }

    await db.insert(template).values({
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      isBuiltIn: true,
    });

    await db.insert(templateColumn).values(
      tmpl.columns.map((column) => ({
        id: randomUUID(),
        templateId: tmpl.id,
        name: column.name,
        emoji: column.emoji,
        prompt: column.prompt,
        order: column.order,
      })),
    );

    console.log(`  Added "${tmpl.name}" template`);
    added++;
  }

  if (added > 0) {
    console.log(`✅ Added ${added} new template(s)`);
  } else {
    console.log('✅ All templates already exist, nothing to add');
  }

  await pool.end();
}

seedTemplates().catch((err) => {
  console.error('Template seeding failed:', err);
  process.exit(1);
});
