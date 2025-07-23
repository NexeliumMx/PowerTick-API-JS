/**
 * File: meterInfo.js
 * Author(s): Andres Gomez
 * Endpoint: GET /api/meterInfo
 * Brief: Fetch general information regarding contract and powermeter
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
const { getClient } = require('../pgPool');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

function getSchema(env) {
    if (!env || env === 'production') return 'public';
    if (ALLOWED_ENVIROMENTS.includes(env)) return env;
    return null;
}

app.http('meterInfo', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const user_id = request.query.get('user_id');
        const powermeter_id = request.query.get('powermeter_id');
        const enviroment = request.query.get('enviroment');

        if (!user_id || !powermeter_id) {
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
        const installationsTable = `public.installations`;
        const userInstallationsTable = `public.user_installations`;

        const query = `
    WITH authorized_powermeter AS (
        SELECT p.installation_id
        FROM ${powermetersTable} p
        JOIN ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
        WHERE ui.user_id = $1
          AND p.powermeter_id = $2
    )

    SELECT
        p.powermeter_alias,
        i.installation_alias,
        i.register_date,
        i.region,
        i.tariff,
        i.installed_capacity,
        i.location,
        i.maintenance_date,
        COUNT(ui.user_id) AS user_count

    FROM ${userInstallationsTable} ui
    JOIN authorized_powermeter ap ON ui.installation_id = ap.installation_id
    JOIN ${powermetersTable} p ON ap.installation_id = p.installation_id
    JOIN ${installationsTable} i ON p.installation_id = i.installation_id

    WHERE ui.installation_id = ap.installation_id
    GROUP BY 
    p.powermeter_alias,
    i.installation_alias,
    i.register_date,
    i.region,
    i.tariff,
    i.installed_capacity,
    i.location,
    i.maintenance_date
    LIMIT 1
`;

        const params = [user_id, powermeter_id];

        try {
            context.log('Handler started');
            context.log(`Received user_id: ${user_id}, powermeter_id: ${powermeter_id}, environment: ${enviroment}`);
            context.log(`Using schema: ${schema}`);
            context.log(`Executing query: ${query}`);
            context.log(`With parameters: ${params}`);

            const client = await getClient();
            const result = await client.query(query, params);
            client.release(); // Release the client back to the pool
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