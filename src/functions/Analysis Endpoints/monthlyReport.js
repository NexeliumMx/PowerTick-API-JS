/**
 * File: monthlyReport.js
 * Author(s): Andres Gomez
 * Endpoint: GET /api/monthlyReprt
 * Brief: Fetch avg PF, max demand, totl consumption for each month of
 * a selected year, validating user access.
 * Date: 2025-06-13
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 4c7c56fe-99fc-4611-b57a-0d5683f9bc95
 * 5
 * 
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
        avg(m.power_factor) AS avg_power_factor,
        max(m.watts) AS max_demand,
        last(m.kwh_imported_total, m."timestamp")-first(m.kwh_imported_total, m."timestamp") AS consumption
    FROM ${measurementsTable} m
    JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
    WHERE m."timestamp" >= DATE_TRUNC('year', TO_TIMESTAMP($3, 'YYYY'))
      AND m."timestamp" < DATE_TRUNC('year', TO_TIMESTAMP($3, 'YYYY') + INTERVAL '1 year')
    GROUP BY month
    ORDER BY month ASC;
`;

        const params = [user_id, powermeter_id, year];

        try {
            context.log('Handler started');
            context.log(`Received user_id: ${user_id}, powermeter_id: ${powermeter_id}, year: ${year}, environment: ${enviroment}`);
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