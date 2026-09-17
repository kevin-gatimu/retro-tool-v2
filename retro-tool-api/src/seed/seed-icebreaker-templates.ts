/**
 * Production-safe icebreaker template seeding script.
 * Seeds all built-in icebreaker templates — idempotent and safe to run in any environment.
 *
 * Run locally:   pnpm db:seed:icebreaker-templates
 * Run staging:   pnpm db:seed:icebreaker-templates:staging
 * Run prod:      pnpm db:seed:icebreaker-templates:prod
 *
 * The staging/prod scripts pre-load `.env.staging.local`/`.env.production.local`
 * via `dotenv_config_path`. The fallback loads below use `override: false` so
 * they never clobber a DATABASE_URL that was already injected that way — they
 * only fill it in for a plain local run.
 */
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '../../.env'), override: false });
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { icebreakerTemplate, icebreakerPrompt } from '../icebreakers/schema';
import { BUILT_IN_ICEBREAKER_TEMPLATES } from '../common/data/built-in-icebreaker-templates';

async function seedIcebreakerTemplates() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log('Seeding built-in icebreaker templates...');

  let added = 0;
  let skipped = 0;

  for (const tmpl of BUILT_IN_ICEBREAKER_TEMPLATES) {
    const [existingById] = await db
      .select({ id: icebreakerTemplate.id })
      .from(icebreakerTemplate)
      .where(eq(icebreakerTemplate.id, tmpl.id))
      .limit(1);

    if (existingById) {
      await db
        .update(icebreakerTemplate)
        .set({
          name: tmpl.name,
          description: tmpl.description,
          flavour: tmpl.flavour,
        })
        .where(eq(icebreakerTemplate.id, tmpl.id));

      const existingPrompts = await db
        .select({ text: icebreakerPrompt.text })
        .from(icebreakerPrompt)
        .where(eq(icebreakerPrompt.templateId, tmpl.id));
      const existingTextSet = new Set(existingPrompts.map((p) => p.text));
      const missingPrompts = tmpl.prompts.filter(
        (p) => !existingTextSet.has(p.text),
      );
      if (missingPrompts.length > 0) {
        await db.insert(icebreakerPrompt).values(
          missingPrompts.map((p) => ({
            id: randomUUID(),
            templateId: tmpl.id,
            text: p.text,
            order: p.order,
            color: p.color ?? null,
          })),
        );
        console.log(
          `  Updated "${tmpl.name}": added ${missingPrompts.length} new prompt(s)`,
        );
      }

      skipped++;
      continue;
    }

    const [existingByName] = await db
      .select({ id: icebreakerTemplate.id })
      .from(icebreakerTemplate)
      .where(
        and(
          ilike(icebreakerTemplate.name, tmpl.name),
          eq(icebreakerTemplate.isBuiltIn, true),
        ),
      )
      .limit(1);

    if (existingByName) {
      skipped++;
      continue;
    }

    await db.insert(icebreakerTemplate).values({
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      flavour: tmpl.flavour,
      isBuiltIn: true,
      organizationId: null,
      color: tmpl.color ?? null,
    });

    await db.insert(icebreakerPrompt).values(
      tmpl.prompts.map((p) => ({
        id: randomUUID(),
        templateId: tmpl.id,
        text: p.text,
        order: p.order,
        color: p.color ?? null,
      })),
    );

    console.log(
      `  Added "${tmpl.name}" template (${tmpl.prompts.length} prompts)`,
    );
    added++;
  }

  if (added > 0) {
    console.log(
      `✅ Added ${added} new icebreaker template(s), skipped ${skipped}`,
    );
  } else {
    console.log(
      `✅ All icebreaker templates already exist (skipped ${skipped})`,
    );
  }

  await pool.end();
}

seedIcebreakerTemplates().catch((err) => {
  console.error('Icebreaker template seeding failed:', err);
  process.exit(1);
});
