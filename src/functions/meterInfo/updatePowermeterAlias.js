const { app } = require('@azure/functions');
const { getClient } = require('../pgPool');

const ALLOWED_ENVIRONMENTS = ['production', 'demo', 'dev'];
const DEFAULT_SCHEMA = 'public';

function getSchema(env) {
  if (!env || env === 'production') return DEFAULT_SCHEMA;
  if (ALLOWED_ENVIRONMENTS.includes(env)) return env;
  return null;
}

app.http('updatePowermeterAlias', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const userId = request.query.get('user_id');
    const powermeterIdRaw = request.query.get('powermeter_id');
    const newAlias = request.query.get('new_alias');
    const environment = request.query.get('enviroment') || 'production';

    // Avoid magic numbers by using a named constant for invalid ID
    const INVALID_ID = Number.NaN;
    const powermeterId = Number(powermeterIdRaw);

    if (
      !userId ||
      !powermeterIdRaw ||
      Number.isNaN(powermeterId) ||
      !newAlias ||
      !newAlias.trim()
    ) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing or invalid parameters' }),
      };
    }

    const schema = getSchema(environment);
    if (!schema) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid environment parameter' }),
      };
    }

    const powermetersTable = `${schema}.powermeters`;
    const userInstallationsTable = `${DEFAULT_SCHEMA}.user_installations`;

    // Check authorization
    const AUTH_CHECK_SQL = `
      SELECT 1
      FROM ${powermetersTable} p
      JOIN ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
      WHERE p.powermeter_id = $1 AND ui.user_id = $2
      LIMIT 1
    `;

    // Update alias
    const UPDATE_ALIAS_SQL = `
      UPDATE ${powermetersTable}
      SET powermeter_alias = $1
      WHERE powermeter_id = $2
      RETURNING powermeter_id, powermeter_alias
    `;

    const client = await getClient();
    try {
      const authResult = await client.query(AUTH_CHECK_SQL, [powermeterId, userId]);
      if (authResult.rowCount === 0) {
        return {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'User not authorized for this powermeter.' }),
        };
      }

      const updateResult = await client.query(UPDATE_ALIAS_SQL, [newAlias, powermeterId]);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          updated: updateResult.rows[0] || null,
        }),
      };
    } catch (error) {
      context.log.error('Database error:', error);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database query failed' }),
      };
    } finally {
      client.release();
    }
  },
});