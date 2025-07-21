/**
 * File: measurementRange.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/measurementRange
 * Brief: Fetch the time range of measurements for a powermeter.
 * Date: 2025-06-02
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { executeQuery } = require('./pgPool');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

app.http('measurementRange', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const powermeterId = request.query.get('powermeter_id');
        let env = request.query.get('enviroment') || 'production';

        // SQL injection protection
        if (!ALLOWED_ENVIROMENTS.includes(env)) {
            return {
                status: 400,
                body: JSON.stringify({ error: 'Invalid enviroment' })
            };
        }

        // Map environment to schema
        let schema = env;
        if (env === 'production') schema = 'public';

        try {
            const sql = `
                WITH minmax AS (
                  SELECT 
                    first("timestamp", "timestamp") AS min_utc,
                    last("timestamp", "timestamp") AS max_utc
                  FROM ${schema}.measurements
                  WHERE powermeter_id = $1
                    AND "timestamp" <= NOW()
                )
                SELECT 
                  m.min_utc,
                  m.max_utc,
                  p.time_zone
                FROM minmax m
                CROSS JOIN ${schema}.powermeters p
                WHERE p.powermeter_id = $1;
            `;
            const result = await executeQuery(sql, [powermeterId]);
            if (result.rows.length === 0) {
                return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
            }
            return { status: 200, body: JSON.stringify(result.rows[0]) };
        } catch (err) {
            context.log('Error fetching measurement range:', err);
            return { status: 500, body: JSON.stringify({ error: 'Internal server error' }) };
        } 
    }
});