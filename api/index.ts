import express, { Router } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { Pool, type PoolClient } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const router = Router();
app.use(express.json());

const CONSULT_TABLE = process.env.DVM_CONSULT_TABLE ?? 'consult_fact_dvm';
const TASK_TABLE = process.env.DVM_TASK_TABLE ?? 'dvm_task_fact';
const DVM_DIM_TABLE = process.env.DVM_DIM_TABLE ?? 'dvm_dim';
const EXCLUDED_SERVICE_TYPES = ['Virtual Locum', 'Testing'];

let pool: Pool | null = null;

type DbClient = PoolClient;
type DashboardRole = 'leadership' | 'admin' | 'manager' | 'dvm';

interface DashboardFilters {
  userId?: string;
  startDate: string;
  endDate: string;
}

const getPool = () => {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
    statement_timeout: 20000,
    max: 5
  });
  return pool;
};

const getClient = async () => {
  const activePool = getPool();
  if (!activePool) {
    return null;
  }
  return activePool.connect();
};

const releaseClient = (client: DbClient | null) => {
  client?.release();
};

const getRole = (req: express.Request): DashboardRole => {
  const raw = String(req.headers['x-dashboard-role'] ?? 'leadership').toLowerCase();
  if (raw === 'admin' || raw === 'manager' || raw === 'dvm') {
    return raw;
  }
  return 'leadership';
};

const getActorUserId = (req: express.Request) => String(req.headers['x-dashboard-user-id'] ?? '').trim();

const parseFilters = (req: express.Request): DashboardFilters => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const userId = typeof req.query.userId === 'string' && req.query.userId.length > 0 ? req.query.userId : undefined;
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required');
  }
  return { userId, startDate, endDate };
};

const authorizeFilters = (req: express.Request, filters: DashboardFilters) => {
  const role = getRole(req);
  if (role !== 'dvm') {
    return;
  }
  const actorUserId = getActorUserId(req);
  if (!actorUserId) {
    throw new Error('DVM role requires x-dashboard-user-id header');
  }
  if (filters.userId && filters.userId !== actorUserId) {
    throw new Error('DVM users can only query their own metrics');
  }
  filters.userId = actorUserId;
};

const buildWhereClause = (filters: DashboardFilters, options?: { includeUser?: boolean; includeServiceExclusion?: boolean }) => {
  const values: Array<string | string[]> = [filters.startDate, filters.endDate];
  const conditions = [
    `created_at >= $1::date`,
    `created_at < ($2::date + interval '1 day')`
  ];
  let idx = 3;
  if (options?.includeServiceExclusion ?? true) {
    conditions.push(`COALESCE(service_type, '') <> ALL($${idx}::text[])`);
    values.push(EXCLUDED_SERVICE_TYPES);
    idx += 1;
  }
  if ((options?.includeUser ?? true) && filters.userId) {
    conditions.push(`owner_dvm_id = $${idx}`);
    values.push(filters.userId);
  }
  return {
    text: `WHERE ${conditions.join(' AND ')}`,
    values
  };
};

const hoursInRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  const inclusiveHours = ((end - start) / 3_600_000) + 24;
  return Math.max(1, inclusiveHours);
};

const mockUsers = [
  { id: 'dvm_1', name: 'Dr. Aurora Chen' },
  { id: 'dvm_2', name: 'Dr. Malik Reyes' },
  { id: 'dvm_3', name: 'Dr. Nia Patel' },
  { id: 'dvm_4', name: 'Dr. Aaron Brooks' }
];

router.get('/api/dvm-dashboard/filters/users', async (_req, res) => {
  let client: DbClient | null = null;
  try {
    client = await getClient();
    if (!client) {
      res.json(mockUsers);
      return;
    }
    const result = await client.query<{ id: string; name: string }>(
      `SELECT dvm_id as id, display_name as name FROM ${DVM_DIM_TABLE} WHERE is_active = true ORDER BY display_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ code: 'users_fetch_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/summary', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    const hours = hoursInRange(filters.startDate, filters.endDate);
    client = await getClient();
    if (!client) {
      const owned = filters.userId ? 38 : 312;
      res.json({
        consultationsOwned: owned,
        availableConsultations: Math.max(5, Math.round(owned * 0.22)),
        consultationsPerHour: Number((owned / hours).toFixed(2)),
        totalDvmsActive: filters.userId ? 1 : 42,
        generatedAt: new Date().toISOString()
      });
      return;
    }

    const where = buildWhereClause(filters);
    const ownedQ = `SELECT COUNT(DISTINCT consult_id)::int AS owned FROM ${CONSULT_TABLE} ${where.text}`;
    const availableQ = `
      SELECT COUNT(DISTINCT consult_id)::int AS available
      FROM ${CONSULT_TABLE}
      ${where.text} AND (status = 'Assigned' OR (status = 'Available' AND claimed_at IS NULL))
    `;
    const activeDvmQ = `
      SELECT COUNT(DISTINCT owner_dvm_id)::int AS total
      FROM ${CONSULT_TABLE}
      ${where.text.replace(/owner_dvm_id = \$\d+/, 'owner_dvm_id IS NOT NULL')}
    `;

    const [ownedResult, availableResult, activeDvmResult] = await Promise.all([
      client.query<{ owned: number }>(ownedQ, where.values),
      client.query<{ available: number }>(availableQ, where.values),
      client.query<{ total: number }>(activeDvmQ, where.values.filter((v) => v !== filters.userId))
    ]);

    const consultationsOwned = Number(ownedResult.rows[0]?.owned ?? 0);
    const availableConsultations = Number(availableResult.rows[0]?.available ?? 0);
    const totalDvmsActive = Number(activeDvmResult.rows[0]?.total ?? 0);
    res.json({
      consultationsOwned,
      availableConsultations,
      consultationsPerHour: Number((consultationsOwned / hours).toFixed(2)),
      totalDvmsActive,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ code: 'summary_fetch_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/service-breakdown', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    client = await getClient();
    if (!client) {
      res.json({
        rows: [
          { serviceType: 'Urgent Care', count: 40, percent: 52.6 },
          { serviceType: 'Follow Up', count: 24, percent: 31.6 },
          { serviceType: 'General Advice', count: 12, percent: 15.8 }
        ],
        excludedServiceTypes: EXCLUDED_SERVICE_TYPES
      });
      return;
    }
    const where = buildWhereClause(filters, { includeServiceExclusion: true });
    const query = `
      WITH service_counts AS (
        SELECT COALESCE(NULLIF(service_type, ''), 'Unknown') AS service_type, COUNT(*)::int AS count
        FROM ${CONSULT_TABLE}
        ${where.text}
        GROUP BY 1
      )
      SELECT
        service_type AS "serviceType",
        count,
        ROUND((count::numeric / NULLIF(SUM(count) OVER(), 0)) * 100, 1)::float AS percent
      FROM service_counts
      ORDER BY count DESC
    `;
    const result = await client.query<{ serviceType: string; count: number; percent: number }>(query, where.values);
    res.json({ rows: result.rows, excludedServiceTypes: EXCLUDED_SERVICE_TYPES });
  } catch (error) {
    res.status(400).json({ code: 'service_breakdown_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/task-stats', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    client = await getClient();
    if (!client) {
      res.json({
        rows: [
          { taskType: 'Prescriptions', count: 14, percent: 43.8, countAvailable: true },
          { taskType: 'Transfers', count: 7, percent: 21.9, countAvailable: true },
          { taskType: 'Diagnostic Requests', count: 11, percent: 34.4, countAvailable: true }
        ]
      });
      return;
    }
    const query = `
      WITH task_rows AS (
        SELECT
          CASE
            WHEN task_type = 'Prescription' THEN 'Prescriptions'
            WHEN task_type = 'Transfer' THEN 'Transfers'
            WHEN task_type = 'DiagnosticRequest' THEN 'Diagnostic Requests'
            ELSE NULL
          END AS task_type
        FROM ${TASK_TABLE}
        WHERE created_at >= $1::date
          AND created_at < ($2::date + interval '1 day')
          ${filters.userId ? 'AND owner_dvm_id = $3' : ''}
      ), counts AS (
        SELECT task_type, COUNT(*)::int AS count
        FROM task_rows
        WHERE task_type IS NOT NULL
        GROUP BY task_type
      )
      SELECT
        task_type AS "taskType",
        count,
        ROUND((count::numeric / NULLIF(SUM(count) OVER(), 0)) * 100, 1)::float AS percent
      FROM counts
      ORDER BY count DESC
    `;
    const values = filters.userId ? [filters.startDate, filters.endDate, filters.userId] : [filters.startDate, filters.endDate];
    const result = await client.query<{ taskType: string; count: number; percent: number }>(query, values);
    res.json({
      rows: result.rows.map((row) => ({ ...row, countAvailable: true }))
    });
  } catch (error) {
    res.status(400).json({ code: 'task_stats_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/cancellations', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    client = await getClient();
    if (!client) {
      res.json({
        totalCancelled: 21,
        byReason: [
          { reasonCode: 'owner_request', reasonLabel: 'Owner Request', count: 10, percent: 47.6 },
          { reasonCode: 'duplicate', reasonLabel: 'Duplicate Consult', count: 7, percent: 33.3 },
          { reasonCode: 'other', reasonLabel: 'Other', count: 4, percent: 19.0 }
        ]
      });
      return;
    }
    const where = buildWhereClause(filters, { includeServiceExclusion: false });
    const query = `
      WITH grouped AS (
        SELECT
          COALESCE(NULLIF(cancellation_reason, ''), 'unknown') AS reason_code,
          COUNT(*)::int AS count
        FROM ${CONSULT_TABLE}
        ${where.text} AND cancelled_at IS NOT NULL
        GROUP BY 1
      )
      SELECT
        reason_code AS "reasonCode",
        INITCAP(REPLACE(reason_code, '_', ' ')) AS "reasonLabel",
        count,
        ROUND((count::numeric / NULLIF(SUM(count) OVER(), 0)) * 100, 1)::float AS percent
      FROM grouped
      ORDER BY count DESC
    `;
    const result = await client.query<{ reasonCode: string; reasonLabel: string; count: number; percent: number }>(query, where.values);
    const totalCancelled = result.rows.reduce((sum, row) => sum + row.count, 0);
    res.json({ totalCancelled, byReason: result.rows });
  } catch (error) {
    res.status(400).json({ code: 'cancellations_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/pph-addons', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    client = await getClient();
    if (!client) {
      res.json({ count: 18 });
      return;
    }
    const query = `
      SELECT COUNT(DISTINCT consult_id)::int AS count
      FROM ${CONSULT_TABLE}
      WHERE created_at >= $1::date
        AND created_at < ($2::date + interval '1 day')
        AND has_pph_addon = true
    `;
    const result = await client.query<{ count: number }>(query, [filters.startDate, filters.endDate]);
    res.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    res.status(400).json({ code: 'pph_addons_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/time-between-consults', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    client = await getClient();
    if (!client) {
      res.json({ averageMinutes: 17.4, medianMinutes: 11.2, p90Minutes: 38.7, sampleSize: 124 });
      return;
    }
    const where = buildWhereClause(filters, { includeServiceExclusion: false });
    const query = `
      WITH eligible AS (
        SELECT
          owner_dvm_id,
          COALESCE(claimed_at, assigned_at, created_at) AS event_ts
        FROM ${CONSULT_TABLE}
        ${where.text} AND status IN ('Assigned', 'Claimed')
      ), intervals AS (
        SELECT
          owner_dvm_id,
          EXTRACT(EPOCH FROM (event_ts - LAG(event_ts) OVER (PARTITION BY owner_dvm_id ORDER BY event_ts))) / 60.0 AS gap_minutes
        FROM eligible
      )
      SELECT
        COALESCE(AVG(gap_minutes), 0)::float AS "averageMinutes",
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_minutes), 0)::float AS "medianMinutes",
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY gap_minutes), 0)::float AS "p90Minutes",
        COUNT(*)::int AS "sampleSize"
      FROM intervals
      WHERE gap_minutes IS NOT NULL AND gap_minutes >= 0
    `;
    const result = await client.query<{
      averageMinutes: number;
      medianMinutes: number;
      p90Minutes: number;
      sampleSize: number;
    }>(query, where.values);
    res.json(result.rows[0] ?? { averageMinutes: 0, medianMinutes: 0, p90Minutes: 0, sampleSize: 0 });
  } catch (error) {
    res.status(400).json({ code: 'time_between_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/graphs/consults-per-hour', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    authorizeFilters(req, filters);
    const hours = hoursInRange(filters.startDate, filters.endDate);
    client = await getClient();
    if (!client) {
      const mockPoints = Array.from({ length: 24 }, (_, index) => {
        const consultationsOwned = 4 + Math.round(Math.sin(index / 3) * 3 + 3);
        return {
          hourBucket: `${String(index).padStart(2, '0')}:00`,
          consultationsOwned,
          consultationsPerHour: Number((consultationsOwned / 1).toFixed(2))
        };
      });
      res.json({ points: mockPoints });
      return;
    }
    const where = buildWhereClause(filters);
    const query = `
      WITH hourly AS (
        SELECT
          TO_CHAR(DATE_TRUNC('hour', created_at), 'YYYY-MM-DD HH24:00') AS hour_bucket,
          COUNT(*)::int AS owned
        FROM ${CONSULT_TABLE}
        ${where.text}
        GROUP BY 1
      )
      SELECT
        hour_bucket AS "hourBucket",
        owned AS "consultationsOwned",
        ROUND((owned::numeric / GREATEST(1, $4::numeric)), 2)::float AS "consultationsPerHour"
      FROM hourly
      ORDER BY hour_bucket ASC
    `;
    const baseValues = [...where.values];
    const result = await client.query<{ hourBucket: string; consultationsOwned: number; consultationsPerHour: number }>(query, [
      ...baseValues,
      hours
    ]);
    res.json({ points: result.rows });
  } catch (error) {
    res.status(400).json({ code: 'graph_fetch_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/leaderboard/top-dvms', async (req, res) => {
  let client: DbClient | null = null;
  try {
    const filters = parseFilters(req);
    const hours = hoursInRange(filters.startDate, filters.endDate);
    client = await getClient();
    if (!client) {
      res.json({
        rows: mockUsers.slice(0, 4).map((user, index) => ({
          rank: index + 1,
          userId: user.id,
          userName: user.name,
          consultationsOwned: 90 - index * 8,
          consultationsPerHour: Number(((90 - index * 8) / hours).toFixed(2))
        })),
        limit: 10
      });
      return;
    }
    const query = `
      WITH base AS (
        SELECT owner_dvm_id, COUNT(*)::int AS owned
        FROM ${CONSULT_TABLE}
        WHERE created_at >= $1::date
          AND created_at < ($2::date + interval '1 day')
        GROUP BY owner_dvm_id
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY (owned::numeric / GREATEST(1, $3::numeric)) DESC, owned DESC)::int AS rank,
        b.owner_dvm_id AS "userId",
        COALESCE(d.display_name, b.owner_dvm_id) AS "userName",
        b.owned AS "consultationsOwned",
        ROUND((b.owned::numeric / GREATEST(1, $3::numeric)), 2)::float AS "consultationsPerHour"
      FROM base b
      LEFT JOIN ${DVM_DIM_TABLE} d ON d.dvm_id = b.owner_dvm_id
      ORDER BY rank
      LIMIT 10
    `;
    const result = await client.query<{
      rank: number;
      userId: string;
      userName: string;
      consultationsOwned: number;
      consultationsPerHour: number;
    }>(query, [filters.startDate, filters.endDate, hours]);
    res.json({ rows: result.rows, limit: 10 });
  } catch (error) {
    res.status(400).json({ code: 'leaderboard_failed', message: String(error) });
  } finally {
    releaseClient(client);
  }
});

router.get('/api/dvm-dashboard/iframe/signed-url', (req, res) => {
  try {
    const filters = parseFilters(req);
    const secret = process.env.DVM_IFRAME_SIGNING_SECRET ?? 'dvm-default-secret';
    const payload = JSON.stringify({
      userId: filters.userId ?? null,
      startDate: filters.startDate,
      endDate: filters.endDate,
      exp: Date.now() + (5 * 60 * 1000)
    });
    const encoded = Buffer.from(payload).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    res.json({ token: `${encoded}.${signature}` });
  } catch (error) {
    res.status(400).json({ code: 'iframe_sign_failed', message: String(error) });
  }
});

app.use(router);

export { app };
export default app;
