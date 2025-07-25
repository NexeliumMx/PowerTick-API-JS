const { app } = require('@azure/functions');
const { getClient } = require('../pgPool');

const ALLOWED_ENVIRONMENTS = ['production', 'demo', 'dev'];
const DEFAULT_SCHEMA = 'public';

function getSchema(env) {
  if (!env || env === 'production') return DEFAULT_SCHEMA;
  if (ALLOWED_ENVIRONMENTS.includes(env)) return env;
  return null;
}

app.http('updateInstallationAlias', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const userId = request.query.get('user_id');
    const installationIdRaw = request.query.get('installation_id');
    const newAlias = request.query.get('new_alias');
    const environment = request.query.get('enviroment') || 'production';

    const INVALID_ID = Number.NaN;
    const installationId = Number(installationIdRaw);

    if (
      !userId ||
      !installationIdRaw ||
      Number.isNaN(installationId) ||
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

    const installationsTable = `${DEFAULT_SCHEMA}.installations`;
    const userInstallationsTable = `${DEFAULT_SCHEMA}.user_installations`;

    // Check authorization
    const AUTH_CHECK_SQL = `
      SELECT 1
      FROM ${userInstallationsTable}
      WHERE installation_id = $1 AND user_id = $2
      LIMIT 1
    `;

    // Update alias
    const UPDATE_ALIAS_SQL = `
      UPDATE ${installationsTable}
      SET installation_alias = $1
      WHERE installation_id = $2
      RETURNING installation_id, installation_alias
    `;

    const client = await getClient();
    try {
      const authResult = await client.query(AUTH_CHECK_SQL, [installationId, userId]);
      if (authResult.rowCount === 0) {
        return {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'User not authorized for this installation.' }),
        };
      }

      const updateResult = await client.query(UPDATE_ALIAS_SQL, [newAlias, installationId]);
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