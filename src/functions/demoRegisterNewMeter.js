/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 2024-11-20
 *
 * This function serves as an HTTP POST endpoint to register a new powermeter in the database.
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
 * curl -X POST "http://localhost:7071/api/demoRegisterNewMeter." \
 * -H "Content-Type: application/json" \
 * -d '{ 
 *     "serial_number": "DEMO0000010",
 *     "manufacturer": "AccurEnergy",
 *     "series": "Accurev1330",
 *     "model": "Accurev1335",
 *     "firmware_v": "321"
 * }'
 */
const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoRegisterNewMeter', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const client = await getClient(); // Await the database client initialization

        try {
            // Parse the JSON payload
            const meter = await request.json();
            context.log("Received request payload:", meter);

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

            // SQL query for insertion
            const query = `
                INSERT INTO demo.powermeters (${columns}, register_date)
                VALUES (${values}, NOW())
            `;
            context.log("Constructed query:", query);

            // Execute the query
            await client.query(query, Object.values(meterWithDefaults));
            context.log(`Inserted meter with serial_number: ${meter.serial_number}`);

            return { status: 200, body: 'Meter successfully registered.' };
        } catch (error) {
            context.log.error('Error inserting meter:', error);
            return { status: 500, body: `Error: ${error.message}` };
        } finally {
            // Release the database client
            client.release();
        }
    },
});