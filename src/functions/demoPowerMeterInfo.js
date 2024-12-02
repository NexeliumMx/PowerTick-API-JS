/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 02-12-2024
 *
 * Objective:
 * This function serves as an HTTP GET endpoint to fetch detailed information about a specific powermeter 
 * from the `demo.powermeters` table based on the provided serial number (SN). It validates the input 
 * and returns the powermeter information in JSON format.
 *
 * Key Features:
 * - Accepts a serial number as a query parameter (`?sn=DEMO0000001`).
 * - Validates the presence of the `sn` parameter.
 * - Queries the `demo.powermeters` table for matching records.
 * - Returns the powermeter details as JSON if found.
 * - Handles errors such as missing parameters, no matching records, or query execution issues.
 *
 * Example:
 * Fetch powermeter information for a specific serial number:
 * curl -X GET "http://localhost:7071/api/demoPowerMeterInfo?sn=DEMO0000001"
 */
const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoPowerMeterInfo', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Parse query parameter
        const serialNumber = request.query.get('sn');

        if (!serialNumber) {
            return {
                status: 400,
                body: JSON.stringify({ error: "Missing required query parameter 'sn' (serial number)." })
            };
        }

        const client = await getClient();

        try {
            // Query to get powermeter information
            const query = `
                SELECT * 
                FROM demo.powermeters
                WHERE serial_number = $1
                ORDER BY serial_number ASC;
            `;
            const result = await client.query(query, [serialNumber]);

            // Check if the result is empty
            if (result.rows.length === 0) {
                return {
                    status: 404,
                    body: JSON.stringify({ error: `No powermeter found with serial number '${serialNumber}'` })
                };
            }

            // Return the data as JSON
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.rows) // Serialize the response to JSON
            };
        } catch (error) {
            context.log.error("Error executing query:", error);
            return {
                status: 500,
                body: JSON.stringify({ error: "An error occurred while processing your request." })
            };
        } finally {
            client.release();
        }
    }
});