// Vercel Cron Job: cleanup old data
// Runs weekly (every Sunday at 03:00 UTC)
// Retention: rehearsals 1 year, availability 6 months

import db, { initDatabase, isPostgres } from '../../database/db.js';

export default async function handler(req, res) {
  // Security: verify cron secret
  const authHeader = req.headers.authorization;
  const expectedAuth = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (expectedAuth && authHeader !== expectedAuth) {
    console.warn('[Cron Cleanup] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await initDatabase();

    const results = {
      rehearsals: 0,
      availability: 0,
      timestamp: new Date().toISOString()
    };

    // SQL syntax depends on database type
    // Note: date column is TEXT type in both DBs
    const rehearsalsQuery = isPostgres
      ? `DELETE FROM rehearsals WHERE date::DATE < CURRENT_DATE - INTERVAL '1 year'`
      : `DELETE FROM rehearsals WHERE date < date('now', '-1 year')`;

    const availabilityQuery = isPostgres
      ? `DELETE FROM availability WHERE date::DATE < CURRENT_DATE - INTERVAL '6 months'`
      : `DELETE FROM availability WHERE date < date('now', '-6 months')`;

    // Delete rehearsals older than 1 year
    const rehearsalsResult = await db.run(rehearsalsQuery);
    results.rehearsals = rehearsalsResult?.changes || rehearsalsResult?.rowCount || 0;

    // Delete availability older than 6 months
    const availabilityResult = await db.run(availabilityQuery);
    results.availability = availabilityResult?.changes || availabilityResult?.rowCount || 0;

    console.log('[Cron Cleanup] Success:', results);

    return res.status(200).json({
      success: true,
      deleted: results
    });

  } catch (error) {
    console.error('[Cron Cleanup] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
