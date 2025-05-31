/**
 * Author(s): Arturo Vargas
 * Brief: HTTP POST endpoint to register a new measurement in the correct schema based on powermeter serial_number.
 * Date: 2025-05-23
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
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
                    validKeys: validVars
                })
            };
        }

        // Check for required fields
        const requiredFields = ['timestamp_utc', 'serial_number'];
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

        // Validate timestamp_utc is ISO 8601 and UTC
        const ts = payload.timestamp_utc;
        const iso8601utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        if (!iso8601utc.test(ts)) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'timestamp_utc must be in ISO 8601 UTC format (e.g., 2024-12-05T18:00:00.000Z).'
                })
            };
        }

        // Find schema for serial_number
        const serialNumber = payload.serial_number;
        const findSchemaQuery = `
            SELECT 'demo' AS schema FROM demo.powermeters WHERE serial_number = $1
            UNION ALL
            SELECT 'dev' AS schema FROM dev.powermeters WHERE serial_number = $1
            UNION ALL
            SELECT 'production' AS schema FROM production.powermeters WHERE serial_number = $1;
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
            const schema = schemaRes.rows[0].schema;
            // Get time_zone for this powermeter
            const tzRes = await client.query(
                `SELECT time_zone FROM ${schema}.powermeters WHERE serial_number = $1`,
                [serialNumber]
            );
            if (!tzRes.rows.length) {
                client.release();
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Time zone not found for this powermeter.' })
                };
            }
            const timeZone = tzRes.rows[0].time_zone;
            // Convert timestamp_utc to timestamp_tz in the powermeter's time zone
            const timestamp_utc = payload.timestamp_utc;
            const tzQuery = `SELECT ($1::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE $2 AS timestamp_tz`;
            const tzValRes = await client.query(tzQuery, [timestamp_utc, timeZone]);
            const timestamp_tz = tzValRes.rows[0].timestamp_tz;
            // Prepare insert
            // Remove timestamp_tz if present in payload
            const insertPayload = { ...payload };
            delete insertPayload.timestamp_tz;
            const columns = Object.keys(insertPayload);
            const values = Object.values(insertPayload);
            const placeholders = columns.map((_, i) => `$${i + 1}`);
            // Build the insert query with timestamp_tz as a subquery
            const insertColumns = [...columns];
            const insertPlaceholders = [...placeholders];
            // Insert timestamp_tz after timestamp_utc
            const tsUtcIdx = insertColumns.indexOf('timestamp_utc');
            insertColumns.splice(tsUtcIdx + 1, 0, 'timestamp_tz');
            insertPlaceholders.splice(tsUtcIdx + 1, 0, `(
                $${tsUtcIdx + 1}::timestamptz AT TIME ZONE (
                    SELECT time_zone FROM ${schema}.powermeters WHERE serial_number = $${columns.indexOf('serial_number') + 1}
                )
            )`);
            const insertQuery = `INSERT INTO ${schema}.measurements (${insertColumns.join(',')}) VALUES (${insertPlaceholders.join(',')})`;
            await client.query(insertQuery, values);
            client.release();
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

