/**
 * Author(s): Arturo Vargas
 * Brief: HTTP POST endpoint to register a new measurement in the correct schema based on powermeter serial_number.
 * Date: 2025-05-23
 *
 * Description:
 * HTTP POST endpoint to register a new measurement in the correct schema based on powermeter serial_number.
 *
 * - Validates incoming variable names against allowed measurement fields (see validVariablesNames.json, "measurements" array).
 * - Requires 'timestamp_utc' and 'serial_number' fields in the payload.
 * - Validates 'timestamp_utc' is in ISO 8601 UTC format.
 * - Finds the schema for the powermeter using the serial_number.
 * - Inserts the measurement into the correct schema's measurements table.
 * - Returns errors for invalid/missing fields, invalid timestamp, or if serial_number is not found in any schema.
 * - Returns the exact error message from PostgreSQL if an error occurs during insert.
 *
 * Example:
 * Register a new Measurement:
 curl -i -X POST http://localhost:7071/api/postMeasurement \
 -H "Content-Type: application/json" \
 -d '{
     "timestamp_utc": "2024-12-05T18:00:00.000Z",
     "serial_number": "production0000010",
     "current_total": 1182,
     "current_l1": 170,
     "current_l2": 490,
     "current_l3": 522,
     "voltage_ln": 126
}'
 curl -i -X POST https://power-tick-api-js.nexelium.mx/api/postMeasurement \
 -H "Content-Type: application/json" \
 -d '{
     "timestamp_utc": "2024-12-05T18:00:00.000Z",
     "serial_number": "production0000010",
     "current_total": 1182,
     "current_l1": 170,
     "current_l2": 490,
     "current_l3": 522,
     "voltage_ln": 126
}'
 *
 * Responses:
 * 1. Success:
 *    HTTP 200 with a success message.
 * 2. Invalid Field Test:
 *    HTTP 400 with error and invalid/valid keys.
 * 3. Missing Required Field:
 *    HTTP 400 with error and requiredFields.
 * 4. Invalid Timestamp:
 *    HTTP 400 with error about timestamp_utc format.
 * 5. Serial Number Not Found:
 *    HTTP 404 with error.
 * 6. Database Error:
 *    HTTP 500 with error message from PostgreSQL.
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

