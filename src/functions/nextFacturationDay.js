/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 06-12-2024
 *
 * This function serves as an HTTP GET endpoint to return the last day of the current month
 * at 23:59:59 in ISO 8601 Zulu (UTC) timestamp format.
 *
 * Example:
 * GET:
 * curl -X GET http://localhost:7071/api/nextFacturationDay
 *
 * Expected Response:
 * HTTP 200
 * {
 *     "nextFacturationDay": "2024-12-31T23:59:59Z"
 * }
 */

const { app } = require('@azure/functions');
const { DateTime } = require('luxon');

app.http('nextFacturationDay', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Get the current date in the America/Mexico_City time zone
            const now = DateTime.now().setZone('America/Mexico_City');

            // Get the last day of the current month at 23:59:59 in America/Mexico_City time
            const lastDay = now.endOf('month').set({ hour: 23, minute: 59, second: 59 });

            // Convert to Zulu (UTC) time and format as an ISO 8601 string
            const zuluTime = lastDay.toUTC().toISO().replace(/\.\d{3}/, ''); // Remove milliseconds

            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nextFacturationDay: zuluTime })
            };
        } catch (error) {
            console.error('Error generating next facturation day:', error);
            return {
                status: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});