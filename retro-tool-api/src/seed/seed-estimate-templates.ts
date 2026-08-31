/**
 * Production-safe estimate template seeding script.
 * Seeds all built-in estimate templates — idempotent and safe to run in any environment.
 *
 * Run locally:  pnpm db:seed:estimate-templates
 */
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '../../.env'), override: false });
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { estimateTemplate, estimateTemplateValue } from '../estimates/schema';
import { BUILT_IN_ESTIMATE_TEMPLATES } from '../common/data/built-in-estimate-templates';

async function seedEstimateTemplates() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log('Seeding built-in estimate templates...');

  let added = 0;
  let skipped = 0;

  for (const tmpl of BUILT_IN_ESTIMATE_TEMPLATES) {
    const [existingById] = await db
      .select({ id: estimateTemplate.id })
      .from(estimateTemplate)
      .where(eq(estimateTemplate.id, tmpl.id))
      .limit(1);

    if (existingById) {
      await db
        .update(estimateTemplate)
        .set({ name: tmpl.name, description: tmpl.description })
        .where(eq(estimateTemplate.id, tmpl.id));

      const existingValues = await db
        .select({ value: estimateTemplateValue.value })
        .from(estimateTemplateValue)
        .where(eq(estimateTemplateValue.templateId, tmpl.id));
      const existingValueSet = new Set(existingValues.map((v) => v.value));
      const missingValues = tmpl.values.filter(
        (v) => !existingValueSet.has(v.value),
      );
      if (missingValues.length > 0) {
        await db.insert(estimateTemplateValue).values(
          missingValues.map((v) => ({
            id: randomUUID(),
            templateId: tmpl.id,
            label: v.label,
            value: v.value,
            order: v.order,
            color: v.color ?? null,
            description: v.description ?? null,
          })),
        );
        console.log(
          `  Updated "${tmpl.name}": added ${missingValues.length} new value(s)`,
        );
      }

      skipped++;
      continue;
    }

    const [existingByName] = await db
      .select({ id: estimateTemplate.id })
      .from(estimateTemplate)
      .where(
        and(
          ilike(estimateTemplate.name, tmpl.name),
          eq(estimateTemplate.isBuiltIn, true),
        ),
      )
      .limit(1);

    if (existingByName) {
      skipped++;
      continue;
    }

    await db.insert(estimateTemplate).values({
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      isBuiltIn: true,
      organizationId: null,
      color: tmpl.color ?? null,
    });

    await db.insert(estimateTemplateValue).values(
      tmpl.values.map((v) => ({
        id: randomUUID(),
        templateId: tmpl.id,
        label: v.label,
        value: v.value,
        order: v.order,
        color: v.color ?? null,
        description: v.description ?? null,
      })),
    );

    console.log(
      `  Added "${tmpl.name}" template (${tmpl.values.length} values)`,
    );
    added++;
  }

  if (added > 0) {
    console.log(
      `✅ Added ${added} new estimate template(s), skipped ${skipped}`,
    );
  } else {
    console.log(`✅ All estimate templates already exist (skipped ${skipped})`);
  }

  await pool.end();
}

seedEstimateTemplates().catch((err) => {
  console.error('Estimate template seeding failed:', err);
  process.exit(1);
});
