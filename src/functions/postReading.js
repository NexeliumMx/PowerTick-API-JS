/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 05-12-2024
 *
 * This function serves as an HTTP POST endpoint to register a new reading in the database.
 * It dynamically validates the fields provided in the JSON payload against a predefined list 
 * of valid field names (loaded from `validVariablesNames.json`). If validation passes, it 
 * constructs an SQL query dynamically to insert the provided data into the `production.measurements` table.
 *
 * Example:
 * Register a new reading:
 * curl -i -X POST http://localhost:7071/api/postReading \
 * -H "Content-Type: application/json" \
 * -d '{
 *     "timestamp": "2024-12-05T18:00:00.000Z",
 *     "serial_number": "production0000001",
 *     "amps_total": 1182,
 *     "amps_phase_a": 170,
 *     "amps_phase_b": 490,
 *     "amps_phase_c": 522,
 *     "voltage_ln_average": 126
 * }'
 *
 * Responses:
 * 1. Success: 
 *    HTTP 200 with a success message:
 *    {
 *        "message": "Reading for serial number production0000001 was registered successfully in production.measurements."
 *    }
 *
 * 2. Invalid Field Test:
 *    Result: A 400 Bad Request with an error message indicating the invalid field(s):
 *    {
 *        "error": "Invalid variable names detected.",
 *        "invalidKeys": ["invalid_field"],
 *        "validKeys": [ list of valid keys ]
 *    }
 *
 * 3. Database Error:
 *    Result: A 500 Internal Server Error with the error message from PostgreSQL.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
const fs = require('fs');
const path = require('path');

// Load valid variable names from JSON file
const validVariablesPath = path.join(__dirname, './validVariablesNames.json');
let validVariables;

try {
    validVariables = JSON.parse(fs.readFileSync(validVariablesPath)).measurements;
} catch (err) {
    console.error('Failed to load valid variable names:', err.message);
    process.exit(1); // Exit if the file cannot be loaded
}

app.http('postReading', {
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
        const query = `INSERT INTO production.measurements (${columns}) VALUES (${values});`;

        let client;
        try {
            client = await getClient();
            await client.query(query, Object.values(data));

            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: `Reading for serial number ${data.serial_number} was registered successfully in production.measurements.` })
            };
        } catch (error) {
            console.error('Error inserting reading:', error);
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