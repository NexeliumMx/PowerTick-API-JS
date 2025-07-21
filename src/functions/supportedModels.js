/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 20-11-2024
 *
 * This function serves as an HTTP GET endpoint to retrieve the list of supported powermeter models.
 * It provides information about the manufacturer, series, and model of each supported device.
 *
 * Example:
 * Query supported models:
 * curl -X GET "http://localhost:7071/api/supportedModels"
 */

const { app } = require('@azure/functions');
const { executeQuery } = require('./pgPool');

app.http('supportedModels', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            // Query to retrieve all rows from public.supported_models
            const query = 'SELECT serial, manufacturer, series, model FROM public.supported_models;';
            const result = await executeQuery(query);

            // Format the result into JSON format
            const supportedModels = result.rows.map(row => ({
                SERIAL: row.serial,
                manufacturer: row.manufacturer,
                series: row.series,
                model: row.model
            }));

            // Return the JSON response
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supportedModels)
            };
        } catch (error) {
            context.log.error("Database query error:", error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: `Database query failed: ${error.message}` })
            };
        }
    }
});