/**
 * File: loadCenter.js
 * Author(s): Andres Gomez
 * Endpoint: GET /api/loadCenter
 * Brief: Fetch current month: average powerfactor, max demand and consumption.
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

app.http('loadCenter', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const user_id = request.query.get('user_id');
        const enviroment = request.query.get('enviroment');

        if (!user_id) {
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
    )
    SELECT
        m.powermeter_id,
        AVG(m.power_factor) AS avg_power_factor,
        MAX(m.watts) AS max_demand,
        MAX(m.kwh_imported_total) - MIN(m.kwh_imported_total) AS consumption
    FROM ${measurementsTable} m
    JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
    WHERE m."timestamp" >= DATE_TRUNC('month', CURRENT_DATE)
    AND m."timestamp" < DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    GROUP BY m.powermeter_id;
      `;

        const params = [user_id];

        try {
            context.log('Handler started');
            context.log(`Received user_id: ${user_id}, environment: ${enviroment}`);
            context.log(`Using schema: ${schema}`);
            context.log(`Executing query: ${query}`);
            context.log(`With parameters: ${params}`);

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