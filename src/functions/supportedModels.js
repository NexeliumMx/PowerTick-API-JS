const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('supportedModels', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            const client = await getClient();

            // Query to retrieve all rows from public.supported_models
            const query = 'SELECT serial, manufacturer, series, model FROM public.supported_models;';
            const result = await client.query(query);
            client.release(); // Release client back to the pool

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