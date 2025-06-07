/**
 * FileName: src/functions/supportedTimeZones.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/supportedTimeZones
 * Brief: HTTP GET endpoint to fetch all supported time zones from the database.
 * Date: 2025-05-23
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('supportedTimeZones', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        const query = 'SELECT * FROM public.supported_timezones';
        try {
            const client = await getClient();
            context.log('Executing query:', query);
            const res = await client.query(query);
            client.release();
            context.log('Database query executed successfully');
            // Return success message as HTTP response
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows)
            };
        } catch (error) {
            context.log.error('Error during database operation:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: `Database operation failed: ${error.message}` })
            };
        }
    }
});
