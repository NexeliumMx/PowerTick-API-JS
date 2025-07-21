/**
 * FileName: src/functions/powermeter.js
 * Author(s): Arturo Vargas
 * Brief: This function serves as an HTTP POST and GET endpoint for powermeters in the dev, demo, and public schemas.
 * Date: 2025-06-02
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { executeQuery } = require('./pgPool');
const fs = require('fs');
const path = require('path');

// Only allow these enviroments to avoid SQL injection on schema
const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

// Load valid powermeter variable names
const validVarsPath = path.join(__dirname, 'validVariablesNames.json');
const validVars = JSON.parse(fs.readFileSync(validVarsPath, 'utf8')).powermeters;

app.http('powermeter', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // === GET METHOD ===
        if (request.method === 'GET') {
            // Parse URL and query parameters
            const url = new URL(request.url);
            const powermeterId = url.searchParams.get('id');
            const enviroment = url.searchParams.get('enviroment');

            // Require id parameter
            if (!powermeterId) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Missing required query parameter: id' })
                };
            }

            // SQL injection-safe schema selection
            let schema = 'public';
            if (typeof enviroment === 'string') {
                const env = enviroment.toLowerCase();
                if (ALLOWED_ENVIROMENTS.includes(env)) {
                    schema = env === 'production' ? 'public' : env;
                }
            }

            // Query powermeter in the chosen schema
            const detailsQuery = `SELECT * FROM ${schema}.powermeters WHERE powermeter_id = $1`;

            try {
                const detailsRes = await executeQuery(detailsQuery, [powermeterId]);
                if (!detailsRes.rows.length) {
                    return {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: `Powermeter ID not found in ${schema} schema.` })
                    };
                }
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(detailsRes.rows)
                };
            } catch (error) {
                context.log.error('Error during database operation:', error);
                return {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: false, message: `Database operation failed: ${error.message}` })
                };
            }
        }

        // === POST METHOD ===
        let payload;
        try {
            payload = await request.json();
        } catch (err) {
            context.log('Invalid JSON payload');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid JSON payload.' })
            };
        }

        // Validate variable names
        const keys = Object.keys(payload);
        const validKeys = keys.filter(k => validVars.includes(k));
        const invalidKeys = keys.filter(k => !validVars.includes(k));

        if (invalidKeys.length > 0) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid variable names detected.',
                    invalidKeys,
                    validKeys: validVars // Return the full list of valid keys
                })
            };
        }

        // Check for required fields
        const requiredFields = ['serial_number', 'model', 'time_zone'];
        const missing = requiredFields.filter(field => !validKeys.includes(field));
        if (missing.length > 0) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required field(s).',
                    missing
                })
            };
        }

        // SQL injection-safe schema selection
        let schema = 'public';
        if (typeof payload.enviroment === 'string') {
            const env = payload.enviroment.toLowerCase();
            if (ALLOWED_ENVIROMENTS.includes(env)) {
                schema = env === 'production' ? 'public' : env;
            }
        }

        // Remove enviroment from insert
        const insertPayload = { ...payload };
        delete insertPayload.enviroment;

        // Prepare columns and values for parameterized query
        const columns = Object.keys(insertPayload);
        const values = Object.values(insertPayload);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

        const query = `INSERT INTO ${schema}.powermeters (${columns.join(',')}) VALUES (${placeholders.join(',')})`;

        try {
            context.log('Executing query:', query, 'with values:', values);
            await executeQuery(query, values);
            context.log('Database insert executed successfully');
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, message: 'Powermeter registered successfully.' })
            };
        } catch (error) {
            context.log.error('Error during database operation:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: `Database operation failed: ${error.message}` })
            };
        }
    }
});