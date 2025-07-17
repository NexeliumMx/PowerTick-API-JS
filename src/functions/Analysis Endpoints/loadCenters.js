/**
 * File: loadCenters.js
 * Author(s): Andres Gomez, Arturo Vargas
 * Endpoint: /api/loadCenters
 * Brief: Returns current month consumption, average demand, max demand, and average power factor for all powermeters a user has access to.
 * Date: 2025-06-23
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * Parameters:
 *   - user_id (required)
 *   - enviroment: 'production' | 'demo' | 'dev' (optional)
 */

const { app } = require('@azure/functions');
const { getClient } = require('../dbClient');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

app.http('loadCenters', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // --- Parse and Validate Params ---
        const user_id = request.query.get('user_id');
        let enviroment = request.query.get('enviroment') || 'production';

        // SQL injection protection
        if (!user_id) {
            return { status: 400, body: JSON.stringify({ error: "Missing required parameter: user_id" }) };
        }
        if (!ALLOWED_ENVIROMENTS.includes(enviroment)) {
            return { status: 400, body: JSON.stringify({ error: "Invalid enviroment" }) };
        }

        // Schema selection
        let schema = 'public';
        if (enviroment === 'demo') schema = 'demo';
        else if (enviroment === 'dev') schema = 'dev';

        // --- Build SQL ---
        const sql = `
            WITH authorized_powermeter AS (
                SELECT p.powermeter_id
                FROM ${schema}.powermeters p
                JOIN public.user_installations ui ON p.installation_id = ui.installation_id
                WHERE ui.user_id = $1
            ),
            month_range AS (
                SELECT
                    date_trunc('month', NOW()) AS month_start,
                    (date_trunc('month', NOW()) + INTERVAL '1 month') AS month_end
            ),
            consumption AS (
                SELECT
                    m.powermeter_id,
                    last(m.kwh_imported_total, m."timestamp") - first(m.kwh_imported_total, m."timestamp") AS consumption
                FROM ${schema}.measurements m
                JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
                CROSS JOIN month_range
                WHERE m."timestamp" >= month_range.month_start
                  AND m."timestamp" < month_range.month_end
                GROUP BY m.powermeter_id
            ),
            demand AS (
                SELECT
                    m.powermeter_id,
                    last(m.watts, m."timestamp") AS last_demand,
                    avg(m.watts) AS avg_demand,
                    max(m.watts) AS max_demand,
                    avg(m.power_factor) AS avg_power_factor,
                    last(m.power_factor, m."timestamp") AS last_power_factor
                FROM ${schema}.measurements m
                JOIN authorized_powermeter ap ON m.powermeter_id = ap.powermeter_id
                CROSS JOIN month_range
                WHERE m."timestamp" >= month_range.month_start
                  AND m."timestamp" < month_range.month_end
                GROUP BY m.powermeter_id
            )
            SELECT
                c.powermeter_id,
                c.consumption,
                d.avg_demand,
                d.max_demand,
                d.avg_power_factor,
                d.last_demand,
                d.last_power_factor
            FROM consumption c
            JOIN demand d ON c.powermeter_id = d.powermeter_id
            ORDER BY c.powermeter_id;
        `;

        // --- Execute SQL ---
        try {
            const client = await getClient();
            const result = await client.query(sql, [user_id]);
            client.release(); // Release the client back to the pool
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.rows),
            };
        } catch (error) {
            context.log(error);
            return {
                status: 500,
                body: JSON.stringify({ error: "Database error", details: error.message })
            };
        }
    }
});