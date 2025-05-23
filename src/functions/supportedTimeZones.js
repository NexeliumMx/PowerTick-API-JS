/**
 * FileName: src/functions/supportedTimeZones.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch all supported time zones from the database.
 * Date: 2025-05-23
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch all supported time zones from the public.supported_timezones table.
 * It connects to the PostgreSQL database using a client from dbClient.js and returns the query results as a JSON response.
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch all supported time zones:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/supportedTimeZones"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/supportedTimeZones"
 *
 * Expected Response:
 * [{"country_code":"MX","tz_identifier":"America/Bahia_Banderas","embedded_comments":"Bahía de Banderas","utc_offset_sdt":{"hours":-6},"utc_offset_dst":{"hours":-6},"abbreviation_sdt":"CST","abbreviation_dst":null} ...]
 * ---------------------------------------------------------------------------
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
