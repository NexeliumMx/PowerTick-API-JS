/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 05-12-2024
 *
 * This function serves as an HTTP POST endpoint to dynamically insert powermeter readings into the database.
 * It expects a JSON object containing valid variable names and values, verifies them against the `measurements` section
 * of `validVariablesNames.json`, and ensures the timestamp is in a valid ISO 8601 format before inserting the data 
 * into the `demo.measurements` table.
 *
 * Conditions for the API to Work:
 * - All variable names in the JSON payload must exist in the `measurements` section of `validVariablesNames.json`.
 * - The `timestamp` must be in ISO 8601 format (e.g., `2024-11-21T19:20:00.000Z` or `2024-11-21T19:20:00.000+00`).
 * - The database table `demo.measurements` must have columns matching the variable names in the JSON payload.
 *
 * Example:
 * Insert a new powermeter reading:
 * curl -X POST "http://localhost:7071/api/demoPostReading" \
 * -H "Content-Type: application/json" \
 * -d '{
 *     "timestamp": "2024-11-21T19:20:00.000Z",
 *     "serial_number": "DEMO0000001",
 *     "amps_total": 1182,
 *     "amps_phase_a": 170,
 *     "amps_phase_b": 490,
 *     "amps_phase_c": 522,
 *     "voltage_ln_average": 126
 * }'
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');
const validVariables = require('./validVariablesNames.json');

app.http('demoPostReading', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for URL "${request.url}"`);

        const client = await getClient(); // Initialize database client

        try {
            // Step 1: Parse the JSON payload
            const reading = await request.json();
            context.log("Received reading:", reading);

            // Step 2: Verify all variable names against the `measurements` section in validVariablesNames.json
            const validKeys = validVariables.measurements; // Use the measurements section
            const invalidKeys = Object.keys(reading).filter(
                (key) => !validKeys.includes(key)
            );

            if (invalidKeys.length > 0) {
                context.log.error("Invalid variable names found:", invalidKeys);
                return {
                    status: 400,
                    body: `Invalid variable names: ${invalidKeys.join(', ')}.\nValid variable names: ${validKeys.join(', ')}`,
                };
            }

            // Step 3: Verify the timestamp is in valid ISO format
            const isoTimestampRegex =
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
            if (!isoTimestampRegex.test(reading.timestamp)) {
                context.log.error("Invalid timestamp format:", reading.timestamp);
                return {
                    status: 400,
                    body: `Invalid timestamp format. Expected ISO format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ss.sss+00:00.`,
                };
            }

            // Step 4: Dynamically construct the SQL query
            const columns = Object.keys(reading).join(', ');
            const values = Object.values(reading)
                .map((_, index) => `$${index + 1}`)
                .join(', ');

            const query = `
                INSERT INTO demo.measurements (${columns})
                VALUES (${values})
            `;
            context.log("Constructed query:", query);

            // Execute the query
            await client.query(query, Object.values(reading));
            context.log("Inserted reading successfully.");

            return {
                status: 200,
                body: "Reading successfully inserted into the database.",
            };
        } catch (error) {
            context.log.error("Error inserting reading:", error);
            return {
                status: 500,
                body: `Error: ${error.message}`,
            };
        } finally {
            // Release the database client
            client.release();
        }
    },
});