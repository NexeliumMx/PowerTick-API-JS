/**
 * FileName: src/functions/powermeter.js
 * Author(s): Arturo Vargas
 * Brief: HTTP POST endpoint to register a new powermeter in the dev or production schema.
 * Date: 2025-05-23
 *
 * Description:
 * This function serves as an HTTP POST endpoint to register a new powermeter in the dev or production schema.
 * It validates the received payload against allowed powermeter fields, checks for required fields, and inserts the data into the appropriate schema table.
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * ---------------------------------------------------------------------------
 * Example:
 * Register a new powermeter:
 * Local:
 *    curl -i -X POST "http://localhost:7071/api/powermeter" -H "Content-Type: application/json" -d '{"dev":"true","serial_number":"production0000010","model":"Accurev1335","thd_enable":"1"}'
 * Production:
 *    curl -i -X POST "https://power-tick-api-js.nexelium.mx/api/powermeter" -H "Content-Type: application/json" -d '{"serial_number":"production0000010","model":"Accurev1335","thd_enable":"1"}'
 *
 * Expected Response (invalid fields):
 * {
 *   "error": "Invalid variable names detected.",
 *   "invalidKeys": ["invalid_field"],
 *   "validKeys": ["serial_number", "model", "thd_enable"]
 * }
 *
 * Expected Response (missing required):
 * {
 *   "error": "Missing required field(s): serial_number, model"
 * }
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
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
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
                    validKeys
                })
            };
        }

        // Check for required fields
        if (!validKeys.includes('serial_number') || !validKeys.includes('model')) {
            const missing = [
                !validKeys.includes('serial_number') ? 'serial_number' : null,
                !validKeys.includes('model') ? 'model' : null
            ].filter(Boolean);
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: `Missing required field(s): ${missing.join(', ')}` })
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