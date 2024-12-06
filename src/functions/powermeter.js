/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 06-12-2024
 *
 * This function serves as an HTTP endpoint to manage powermeters in the database.
 * It provides:
 * 1. POST: Register a new powermeter.
 * 2. GET: Retrieve a powermeter by serial number.
 *
 * POST:
 * Register a new powermeter in the database. The payload must include a valid set of fields.
 * Example:
 * curl -i -X POST http://localhost:7071/api/powermeter \
 * -H "Content-Type: application/json" \
 * -d '{
 *     "serial_number": "DEV0000010",
 *     "model": "Accurev1335",
 *     "thd_enable": "1"
 * }'
 *
 * Expected Responses:
 * 1. Success:
 *    HTTP 200
 *    {
 *        "message": "Powermeter DEV0000010 was registered successfully in dev.powermeters."
 *    }
 *
 * 2. Invalid Field(s):
 *    HTTP 400
 *    {
 *        "error": "Invalid variable names detected.",
 *        "invalidKeys": ["invalid_field"],
 *        "validKeys": [
 *            "client_id", "serial_number", "manufacturer", "series", "model",
 *            "firmware_v", "branch", "location", "coordinates", "load_center",
 *            "register_date", "facturation_interval_months", "facturation_day",
 *            "time_zone", "device_address", "ct", "vt", "thd_enable"
 *        ]
 *    }
 *
 * 3. Database Error (e.g., duplicate key):
 *    HTTP 500
 *    {
 *        "error": "duplicate key value violates unique constraint \"powermeters_pkey\""
 *    }
 *
 * GET:
 * Retrieve a powermeter by its serial number (`sn` query parameter).
 * Example:
 * curl -X GET http://localhost:7071/api/powermeter?sn=DEV0000010
 *
 * Expected Responses:
 * 1. Success:
 *    HTTP 200
 *    {
 *        "serial_number": "DEV0000010",
 *        "model": "Accurev1335",
 *        "thd_enable": "1",
 *        ...
 *    }
 *
 * 2. Missing `sn` Parameter:
 *    HTTP 400
 *    {
 *        "error": "Missing required query parameter: sn"
 *    }
 *
 * 3. No Matching Powermeter:
 *    HTTP 404
 *    {
 *        "error": "No powermeter found with serial number: DEV9999999"
 *    }
 *
 * 4. Database Error:
 *    HTTP 500
 *    {
 *        "error": "<database error message>"
 *    }
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
const fs = require('fs');
const path = require('path');

// Load valid variable names from JSON file
const validVariablesPath = path.join(__dirname, './validVariablesNames.json');
let validVariables;

try {
    validVariables = JSON.parse(fs.readFileSync(validVariablesPath)).powermeters;
} catch (err) {
    console.error('Failed to load valid variable names:', err.message);
    process.exit(1); // Exit if the file cannot be loaded
}

app.http('powermeter', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const method = request.method.toUpperCase();

        if (method === 'POST') {
            // Handle POST: Register a new powermeter
            const data = await request.json();

            // Validate keys against the valid variable list
            const invalidKeys = Object.keys(data).filter(key => !validVariables.includes(key));
            if (invalidKeys.length > 0) {
                return {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        error: "Invalid variable names detected.",
                        invalidKeys,
                        validKeys: validVariables
                    })
                };
            }

            // Build SQL query dynamically
            const columns = Object.keys(data).join(", ");
            const values = Object.keys(data).map((_, idx) => `$${idx + 1}`).join(", ");
            const query = `INSERT INTO dev.powermeters (${columns}) VALUES (${values});`;

            let client;
            try {
                client = await getClient();
                await client.query(query, Object.values(data));

                return {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: `Powermeter ${data.serial_number} was registered successfully in dev.powermeters.` })
                };
            } catch (error) {
                console.error('Error inserting powermeter:', error);
                return {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: error.message })
                };
            } finally {
                if (client) {
                    client.release();
                }
            }
        } else if (method === 'GET') {
            // Handle GET: Retrieve a powermeter by serial number
            const serialNumber = request.query.get('sn');

            if (!serialNumber) {
                return {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: "Missing required query parameter: sn" })
                };
            }

            const query = `SELECT * FROM dev.powermeters WHERE serial_number = $1;`;

            let client;
            try {
                client = await getClient();
                const result = await client.query(query, [serialNumber]);

                if (result.rows.length === 0) {
                    return {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: `No powermeter found with serial number: ${serialNumber}` })
                    };
                }

                return {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(result.rows[0])
                };
            } catch (error) {
                console.error('Error retrieving powermeter:', error);
                return {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: error.message })
                };
            } finally {
                if (client) {
                    client.release();
                }
            }
        } else {
            // Handle unsupported methods
            return {
                status: 405,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Method not allowed" })
            };
        }
    }
});