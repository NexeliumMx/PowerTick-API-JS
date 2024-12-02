/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 02-12-2024
 *
 * This function serves as an HTTP POST endpoint to register a new powermeter in the `dev` schema of the database.
 * It expects a JSON object with meter details, validates that all required fields are present,
 * and automatically adds a hardcoded `client_id` and the current date as `register_date`.
 *
 * Key Features:
 * - Validates that the meter object contains required fields.
 * - Adds a hardcoded `client_id` ('not_set') to each record.
 * - Dynamically constructs column names and values from the JSON attributes for flexibility.
 *
 * Example:
 * Register a new meter:
 * curl -X POST "http://localhost:7071/api/registerNewMeter" \
 * -H "Content-Type: application/json" \
 * -d '{ 
 *     "serial_number": "DEV0000010",
 *     "manufacturer": "AccurEnergy",
 *     "series": "Accurev1330",
 *     "model": "Accurev1335",
 *     "firmware_v": "321"
 * }'
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('registerNewMeter', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for URL "${request.url}"`);

        const client = await getClient(); // Await the database client initialization

        try {
            // Parse the JSON payload
            const meter = await request.json();
            context.log("Received request payload:", JSON.stringify(meter));

            // Validate that the meter object contains required fields
            const requiredFields = ['serial_number', 'manufacturer', 'series', 'model', 'firmware_v'];
            for (const field of requiredFields) {
                if (!meter[field]) {
                    context.log(`Missing required field: ${field}`);
                    return {
                        status: 400,
                        body: `Invalid meter data: Missing required field '${field}'.`,
                    };
                }
            }

            // Add hardcoded client_id
            const meterWithDefaults = {
                client_id: 'not_set', // Hardcoded value
                ...meter,
            };

            // Dynamically construct column names and values from the JSON attributes
            const columns = Object.keys(meterWithDefaults).join(', ');
            const values = Object.values(meterWithDefaults)
                .map((value, index) => `$${index + 1}`)
                .join(', ');

            // SQL query for insertion into the `dev` schema
            const query = `
                INSERT INTO dev.powermeters (${columns}, register_date)
                VALUES (${values}, NOW())
            `;
            context.log("Constructed query:", query);

            // Retry mechanism for transient errors
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    await client.query(query, Object.values(meterWithDefaults));
                    context.log(`Inserted meter with serial_number: ${meter.serial_number}`);
                    break; // Exit loop on success
                } catch (error) {
                    context.log.warn(`Error inserting meter (Attempt ${attempt}):`, error.message);
                    if (attempt === maxRetries) {
                        throw error; // Rethrow error after all retries
                    }
                }
            }

            return { status: 200, body: 'Meter successfully registered in dev schema.' };
        } catch (error) {
            context.log.error('Error inserting meter:', error.stack);
            return { status: 500, body: `Error: ${error.message}` };
        } finally {
            // Release the database client
            client.release();
        }
    },
});