/**
 * File: demandHistory.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/demandHistory
 * Brief: Fetch demand (watts, var) measurements for a powermeter, validating user access and UTC range.
 * Date: 2025-06-02
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getClient } = require('../dbClient');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

function getSchema(env) {
    if (!env || env === 'production') return 'public';
    if (ALLOWED_ENVIROMENTS.includes(env)) return env;
    return null;
}

app.http('demandHistory', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const user_id = request.query.get('user_id');
        const powermeter_id = request.query.get('powermeter_id');
        const start_utc = request.query.get('start_utc');
        const end_utc = request.query.get('end_utc');
        const enviroment = request.query.get('enviroment');

        if (!user_id || !powermeter_id || !start_utc || !end_utc) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Missing required parameters' }),
            };
        }

        const schema = getSchema(enviroment);
        if (!schema) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Invalid environment parameter' }),
            };
        }

        const powermetersTable = `${schema}.powermeters`;
        const measurementsTable = `${schema}.measurements`;
        const userInstallationsTable = `public.user_installations`;

        const query = `
            WITH authorized_powermeter AS (
                SELECT p.powermeter_id
                FROM ${powermetersTable} p
                JOIN ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
                WHERE ui.user_id = $1
                  AND p.powermeter_id = $2
            )
            SELECT
                m."timestamp" AS utc_time,
                m.watts AS real_power_w,
                m.var AS reactive_power_var
            FROM ${measurementsTable} m
            JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
            WHERE m."timestamp" >= $3
              AND m."timestamp" < $4
              AND m."timestamp" <= NOW()
            ORDER BY m."timestamp" ASC;
        `;

        const params = [user_id, powermeter_id, start_utc, end_utc];

        try {
            const client = await getClient();
            const result = await client.query(query, params);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.rows),
            };
        } catch (error) {
            context.log.error('Database error:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: 'Database query failed' }),
            };
        }
    }
});