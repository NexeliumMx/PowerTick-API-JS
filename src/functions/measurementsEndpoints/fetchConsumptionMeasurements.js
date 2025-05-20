/**
 * FileName: src/functions/fetchConsumptionMeasurements.js
 * Author(s): Andrés Gómez 
 * Brief: HTTP GET endpoint to fetch the latest energy consumption measurement entry for a specific powermeter.
 * Date: 2025-04-21
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch the latest energy consumption measurement entry for a specific powermeter.
 * It verifies that the user has access to the powermeter and then retrieves the latest measurement entry.
 * The function obtains its query from the file:
 *    PowerTick-backend/postgresql/dataQueries/fetchData/fetchConsumptionMeasurements.sql
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameters: The function expects query parameters `user_id` and `serial_number` to identify the user and powermeter.
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Schema Setting: The function sets the search path to the desired schema (`demo`).
 *
 * 4. Query Execution: It executes a query to fetch the latest energy consumption measurement entry for the specified powermeter, 
 *    ensuring that the user has access to the powermeter.
 *
 * 5. Response: The function returns the query results as a JSON response with a status code of 200 
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch currents measurements for a powermeter:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/fetchConsumptionMeasurements?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/fetchConsumptionMeasurements?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001"
 *
 * --------------------------------------------------------------------------- 
*/

const { app } = require('@azure/functions');
const { getClient } = require('../dbClient');

app.http('fetchConsumptionMeasurements', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        const serialNumber = request.query.get('serial_number');
        context.log(`Received user_id: ${userId}, serial_number: ${serialNumber}`);

        if (!userId || !serialNumber) {
            context.log('user_id or serial_number is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'user_id and serial_number are required' })
            };
        }

        try {
            const client = await getClient();  // Reuse the connected client from dbClient.js

            // Set the search path to the desired schema
            await client.query('SET search_path TO demo');

            // Query to fetch the latest measurement entry for the specified powermeter
            const query = `
                WITH user_access AS (
                    SELECT 
                        1
                    FROM 
                        powermeters p
                    JOIN 
                        user_installations ui ON p.installation_id = ui.installation_id
                    WHERE 
                        ui.user_id = $1
                        AND p.serial_number = $2
                )
                SELECT 
                    kwh_imported_l1, kwh_imported_l2, kwh_imported_l3, kwh_imported_total
                FROM 
                    measurements
                WHERE 
                    serial_number = $2
                    AND "timestamp_utc" < NOW()
                    AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY 
                    "timestamp_utc" DESC
                LIMIT 1;
            `;
            const values = [userId, serialNumber];
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