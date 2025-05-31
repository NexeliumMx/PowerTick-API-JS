/**
 * FileName: src/functions/powermeter.js
 * Author(s): Arturo Vargas
 * Brief: This function serves as an HTTP POST and GET endpoint for powermeters in the dev, demo, and production schemas.
 * Date: 2025-05-23
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
const fs = require('fs');
const path = require('path');

// Load valid powermeter variable names
const validVarsPath = path.join(__dirname, 'validVariablesNames.json');
const validVars = JSON.parse(fs.readFileSync(validVarsPath, 'utf8')).powermeters;

app.http('powermeter', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'GET') {
            // GET: Find which schema contains the serial_number
            const url = new URL(request.url);
            const serialNumber = url.searchParams.get('sn');
            if (!serialNumber) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Missing required query parameter: sn' })
                };
            }
            const findSchemaQuery = `
                SELECT 'demo' AS schema
                FROM demo.powermeters
                WHERE serial_number = $1
                UNION ALL
                SELECT 'dev' AS schema
                FROM dev.powermeters
                WHERE serial_number = $1
                UNION ALL
                SELECT 'production' AS schema
                FROM production.powermeters
                WHERE serial_number = $1;
            `;
            try {
                const client = await getClient();
                const schemaRes = await client.query(findSchemaQuery, [serialNumber]);
                if (!schemaRes.rows.length) {
                    client.release();
                    return {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Serial number not found in any schema.' })
                    };
                }
                // Use the first found schema
                const foundSchema = schemaRes.rows[0].schema;
                const detailsQuery = `SELECT * FROM ${foundSchema}.powermeters WHERE serial_number = $1`;
                const detailsRes = await client.query(detailsQuery, [serialNumber]);
                client.release();
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
                    requiredFields
                })
            };
        }

        // Determine schema
        const schema = payload.dev === 'true' ? 'dev' : 'production';
        // Remove dev from insert
        const insertPayload = { ...payload };
        delete insertPayload.dev;

        // Prepare columns and values for parameterized query
        const columns = Object.keys(insertPayload);
        const values = Object.values(insertPayload);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

        const query = `INSERT INTO ${schema}.powermeters (${columns.join(',')}) VALUES (${placeholders.join(',')})`;

        try {
            const client = await getClient();
            context.log('Executing query:', query, 'with values:', values);
            await client.query(query, values);
            client.release();
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