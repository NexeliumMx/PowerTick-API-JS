/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 2024-11-21
 *
 * This function serves as an HTTP GET endpoint to retrieve all powermeter data 
 * from the `demo.powermeters` table in the database. The data is returned as a JSON array.
 * It provides a complete view of all the powermeters, including their details such as 
 * serial number, manufacturer, series, model, and more.
 *
 * Example:
 * Retrieve all powermeter data:
 * curl -X GET "http://localhost:7071/api/demoGetPowerMetersInfo"
 *
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoGetPowerMetersInfo', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const client = await getClient(); // Initialize database client

        try {
            // Query to retrieve all data from the demo.powermeters table
            const query = `SELECT * FROM demo.powermeters ORDER BY serial_number ASC`;
            const result = await client.query(query);

            // Return the data as a JSON array
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.rows) // Serialize the response data to JSON
            };
        } catch (error) {
            context.log.error("Error fetching data from demo.powermeters:", error);
            return {
                status: 500,
                body: JSON.stringify({ error: "Failed to fetch data from the database." }) // Ensure error response is serialized
            };
        } finally {
            // Release the database client
            client.release();
        }
    }
});