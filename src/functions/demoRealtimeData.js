/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 2024-11-20
 *
 * This function serves as an HTTP GET endpoint to retrieve real-time data
 * for a specific powermeter based on the provided serial number (SN). 
 * It fetches the most recent measurement available for the given serial number.
 *
 * Example:
 * Query real-time data:
 * curl -X GET "http://localhost:7071/api/demoRealtimeData?sn=DEMO0000001"
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoRealtimeData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Get the serial number from the query parameters
        const serialNumber = request.query.get('sn');
        if (!serialNumber) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Serial number is required in the query parameters.' })
            };
        }

        // Get a pooled client from the connection pool
        const client = await getClient();

        const query = `
            SELECT * FROM "demo"."measurements"
            WHERE "serial_number" = $1
                AND "timestamp" <= DATE_TRUNC('minute', NOW() AT TIME ZONE 'UTC')
            ORDER BY "timestamp" DESC
            LIMIT 1;
        `;

        try {
            const res = await client.query(query, [serialNumber]);

            if (res.rows.length === 0) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'No real-time data found for the specified serial number.' })
                };
            }

            // Return the row data as JSON
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows[0])
            };
        } catch (error) {
            context.log.error('Error fetching real-time data:', error.stack);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Error fetching real-time data.' })
            };
        } finally {
            client.release(); // Release the client back to the pool
        }
    }
});