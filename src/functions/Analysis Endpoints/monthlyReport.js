/**
 * File: monthlyReport.js
 * Author(s): Luis Sanchez
 * Endpoint: GET /api/monthlyReprt
 * Brief: Fetch avg PF, max demand, totl consumption for each month of
 * a selected year, validating user access.
 * Date: 2025-06-13
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

app.http('monthlyReport', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const user_id = request.query.get('user_id');
        const powermeter_id = request.query.get('powermeter_id');
        const year = request.query.get('year');
        const enviroment = request.query.get('enviroment');

        if (!user_id || !powermeter_id || !year) {
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
        DATE_TRUNC('month', m."timestamp") AS month,
        AVG(m.powerfactor) AS avg_power_factor,
        MAX(m.watts) AS max_demand,
        MAX(m.kwh_imported_total) - MIN(m.kwh_imported_total) AS consumption
    FROM ${measurementsTable} m
    JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
    WHERE m."timestamp" >= DATE_TRUNC('year', TO_TIMESTAMP($3, 'YYYY'))
      AND m."timestamp" < DATE_TRUNC('year', TO_TIMESTAMP($3, 'YYYY') + INTERVAL '1 year')
    GROUP BY month
    ORDER BY month ASC;
`;

        const params = [user_id, powermeter_id, year];

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

if (variable && variable.length) {
    // Safe to access length
}