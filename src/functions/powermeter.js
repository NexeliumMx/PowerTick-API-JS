/**
 * FileName: src/functions/powermeter.js
 * Author(s): Arturo Vargas
 * Brief: HTTP endpoint to register a new powermeter or fetch powermeter details by serial number across schemas.
 * Date: 2025-05-23
 *
 * Description:
 * This function serves as an HTTP POST and GET endpoint for powermeters in the dev, demo, and production schemas.
 *
 * POST:
 *   - Registers a new powermeter in the dev or production schema based on the 'dev' field in the payload.
 *   - Validates incoming variable names against allowed powermeter fields (see validVariablesNames.json).
 *   - Requires 'serial_number', 'model', and 'time_zone' fields in the payload.
 *   - Protects against SQL injection using parameterized queries.
 *   - Returns errors for invalid/missing fields, or a success message on insert.
 *
 * GET:
 *   - Receives a serial number as a query parameter (?sn=...)
 *   - Searches for the serial number in demo, dev, and production powermeters tables.
 *   - If found, fetches and returns the full powermeter record from the first schema where it is found.
 *   - If not found, returns a 404 error.
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * ---------------------------------------------------------------------------
 * Example:
 * Register a new powermeter:
 *   curl -i -X POST "http://localhost:7071/api/powermeter" -H "Content-Type: application/json" -d '{"dev":"true","serial_number":"production0000010","model":"Accurev1335","time_zone":"America/Mexico_City"}'
 *   curl -i -X POST "https://power-tick-api-js.nexelium.mx/api/powermeter" -H "Content-Type: application/json" -d '{"serial_number":"production0000010","model":"Accurev1335","time_zone":"America/Mexico_City"}'
 *
 * Fetch powermeter details by serial number:
 *   curl -X GET "http://localhost:7071/api/powermeter?sn=production0000010"
 *   curl -X GET "https://power-tick-api-js.nexelium.mx/api/powermeter?sn=production0000010"
 *
 * Expected Response (invalid fields):
 *   { "error": "Invalid variable names detected.", "invalidKeys": ["invalid_field"], "validKeys": [ ...all valid keys... ] }
 *
 * Expected Response (missing required):
 *   { "error": "Missing required field(s).", "requiredFields": ["serial_number", "model", "time_zone"] }
 *
 * Expected Response (not found):
 *   { "error": "Serial number not found in any schema." }
 * ---------------------------------------------------------------------------
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