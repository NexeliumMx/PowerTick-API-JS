/**
 * Author(s): Arturo Vargas
 * Brief: HTTP POST endpoint to register a new measurement in the correct schema based on powermeter serial_number.
 * Date: 2025-06-02
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { executeQuery } = require('./dbClient');
const fs = require('fs');
const path = require('path');

// Load valid measurement variable names
const validVarsPath = path.join(__dirname, 'validVariablesNames.json');
const validVars = JSON.parse(fs.readFileSync(validVarsPath, 'utf8')).measurements;

app.http('postMeasurement', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        let payload;

        context.log('--- POST /postMeasurement: Started ---');

        // Parse and validate JSON
        try {
            payload = await request.json();
            context.log('Payload received:', JSON.stringify(payload));
        } catch (err) {
            context.log('Invalid JSON payload');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid JSON payload.' })
            };
        }

        // Validate variable names against allowed keys
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
                    validKeys: validVars
                })
            };
        }

        // Check for required fields
        const requiredFields = ['timestamp', 'serial_number'];
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

        // Do NOT validate timestamp format anymore

        // Find schema and powermeter_id for serial_number
        const serialNumber = payload.serial_number;

        const findSchemaQuery = `
            SELECT 'demo' AS schema, powermeter_id FROM demo.powermeters WHERE serial_number = $1
            UNION ALL
            SELECT 'dev' AS schema, powermeter_id FROM dev.powermeters WHERE serial_number = $1
            UNION ALL
            SELECT 'public' AS schema, powermeter_id FROM public.powermeters WHERE serial_number = $1;
        `;

        try {
            const schemaRes = await executeQuery(findSchemaQuery, [serialNumber]);

            if (!schemaRes.rows.length) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Serial number not found in any schema.' })
                };
            }

            // Use the first found match (should only ever match one env)
            const { schema, powermeter_id } = schemaRes.rows[0];

            // Prepare insert
            // Remove serial_number from payload, add powermeter_id
            const { serial_number, ...restPayload } = payload; // destructure to remove serial_number
            const insertPayload = { ...restPayload, powermeter_id };
            const columns = Object.keys(insertPayload);
            const values = Object.values(insertPayload);
            const placeholders = columns.map((_, i) => `$${i + 1}`);

            context.log('Insert query:', `INSERT INTO ${schema}.measurements (${columns.join(',')}) VALUES (${placeholders.join(',')})`);

            await executeQuery(`INSERT INTO ${schema}.measurements (${columns.join(',')}) VALUES (${placeholders.join(',')})`, values);

            context.log('Measurement inserted successfully.');

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Measurement for serial number ${serialNumber} was registered successfully in ${schema}.measurements.`
                })
            };
        } catch (error) {
            context.log.error('Error during database operation:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});