/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 05-12-2024
 *
 * This function serves as an HTTP POST endpoint to register a new powermeter in the database.
 * It dynamically validates the fields provided in the JSON payload against a predefined list 
 * of valid field names (loaded from `validVariablesNames.json`). If validation passes, it 
 * constructs an SQL query dynamically to insert the provided data into the `dev.powermeters` table.
 *
 * Example:
 * Register a new powermeter with only the serial number:
 * curl -i -X POST http://localhost:7071/api/registerNewMeter \
 * -H "Content-Type: application/json" \
 * -d '{
 *     "serial_number": "DEV0000006"
 * }'
 * 
 * Register a new powermeter with additional fields:
 * curl -i -X POST http://localhost:7071/api/registerNewMeter \
 * -H "Content-Type: application/json" \
 * -d '{
 *     "serial_number": "DEV0000010",
 *     "model": "Accurev1335",
 *     "thd_enable": "1"
 * }'
 *
 * Field Validation:
 * The payload must only include valid fields. These fields are:
 * [
 *   "client_id", "serial_number", "manufacturer", "series", "model", 
 *   "firmware_v", "branch", "location", "coordinates", "load_center", 
 *   "register_date", "facturation_interval_months", "facturation_day", 
 *   "time_zone", "device_address", "ct", "vt", "thd_enable"
 * ]
 * 
 * Responses:
 * 1. Success: 
 *    HTTP 200 with a success message:
 *    {
 *        "message": "Powermeter DEV0000006 was registered successfully in dev.powermeters."
 *    }
 * 
 * 2. Invalid Field Test:
 *    curl -i -X POST http://localhost:7071/api/registerNewMeter \
 *    -H "Content-Type: application/json" \
 *    -d '{
 *        "serial_number": "DEV0000011",
 *        "invalid_field": "invalid"
 *    }'
 *
 *    Result: A 400 Bad Request with an appropriate error message indicating the invalid field:
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
 * 3. Duplicate Key Test:
 *    curl -i -X POST http://localhost:7071/api/registerNewMeter -H "Content-Type: application/json" -d '{
 *        "serial_number": "DEV0000006"
 *    }'
 *
 *    Result: A 500 Internal Server Error with a clear message about the duplicate key:
 *    {
 *        "error": "duplicate key value violates unique constraint \"powermeters_pkey\""
 *    }
 *
 * 4. Database Error:
 *    Any other database-related errors are caught and returned as a 500 Internal Server Error with 
 *    the error message provided by PostgreSQL.
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

app.http('registerNewMeter', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
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
    }
});