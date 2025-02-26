/**
 * FileName: src/functions/fetchPowermetersByUserAccess.js
 * Author(s): Arturo Vargas Cuevas
 * Brief: HTTP GET endpoint to fetch powermeters accessible by a specific user.
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch powermeters accessible by a specific user.
 * It verifies that the API can successfully connect to the database and returns the result.
 * The function obtains its query from the file:
 *    PowerTick-backend/postgresql/dataQueries/fetchData/fetchPowermetersByUserAccess.sql
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameter: The function expects a query parameter `user_id` to identify the user.
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Schema Setting: The function sets the search path to the desired schema (`demo`).
 *
 * 4. Query Execution: It executes a query to fetch powermeters by user access, joining the 
 *    powermeters (p) table with the user_installations (ui) table to ensure that only powermeters 
 *    belonging to installations associated with the given user are returned.
 *
 * 5. Response: The function returns the query results as a JSON response with a status code of 200 
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch powermeters by user access:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/fetchPowermetersByUserAccess?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/fetchPowermetersByUserAccess?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95"
 *
 * Expected Response:
 * [{"serial_number":"12345","client_id":"67890","client_alias":"Client Alias","installation_id":"abcde","installation_alias":"Installation Alias"}, ...]
 * --------------------------------------------------------------------------- 
*/

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('fetchPowermetersByUserAccess', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        context.log(`Received user_id: ${userId}`);

        if (!userId) {
            context.log('user_id is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'user_id is required' })
            };
        }

        try {
            const client = await getClient();  // Reuse the connected client from dbClient.js

            // Set the search path to the desired schema
            await client.query('SET search_path TO demo');

            // Query to fetch powermeters by user access
            const query = `
                SELECT 
                    p.serial_number, 
                    p.client_id, 
                    c.client_alias, 
                    p.installation_id, 
                    i.installation_alias
                FROM 
                    powermeters p
                JOIN 
                    user_installations ui ON p.installation_id = ui.installation_id
                JOIN 
                    installations i ON p.installation_id = i.installation_id
                JOIN 
                    clients c ON p.client_id = c.client_id
                WHERE 
                    ui.user_id = $1;
            `;
            const values = [userId];
            context.log(`Executing query: ${query} with values: ${values}`);
            const res = await client.query(query, values);
            client.release(); // Release client back to the pool

            context.log("Database query executed successfully:", res.rows);

            // Return success message as HTTP response
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows)
            };
        } catch (error) {
            context.log.error("Error during database operation:", error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: `Database operation failed: ${error.message}` })
            };
        }
    }
});