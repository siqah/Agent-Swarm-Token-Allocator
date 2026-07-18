import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function runMigrations(pool) {
  let migrationFiles = [];
  try {
    migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.info('Migrations directory not found, skipping.');
      return;
    }
    throw err;
  }

  if (migrationFiles.length === 0) {
    logger.info('No migrations found.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows: applied } = await pool.query(
    "SELECT name FROM _migrations ORDER BY name"
  );
  const appliedSet = new Set(applied.map(r => r.name));

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      logger.debug(`Migration ${file} already applied, skipping.`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    logger.info(`Applying migration: ${file}`);

    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query(
        "INSERT INTO _migrations (name) VALUES ($1)",
        [file]
      );
      await pool.query('COMMIT');
      logger.info(`Migration ${file} applied successfully.`);
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {});
      logger.error(`Migration ${file} failed:`, err.message);
      throw err;
    }
  }
}
