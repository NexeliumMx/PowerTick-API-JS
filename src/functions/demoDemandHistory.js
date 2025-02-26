/**
 * FileName: src/functions/demoDemandHistory.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch power demand history data for a specific powermeter in the demo schema.
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch power demand history data for a specific powermeter in the demo schema.
 * It verifies that the user has access to the powermeter and then retrieves the demand history data based on the specified time interval.
 * The function obtains its queries from the files in:
 *    PowerTick-backend/postgresql/dataQueries/demandHistory
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameters: The function expects a query parameter `time_interval` to specify the time interval for the data retrieval.
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Query Execution: It executes a query to fetch the demand history data for the specified powermeter and time interval,
 *    ensuring that the user has access to the powermeter.
 *
 * 4. Response: The function returns the query results as a JSON response with a status code of 200
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch demand history data for a powermeter:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/demoDemandHistory?time_interval=day"
 *    curl -i -X GET "http://localhost:7071/api/demoDemandHistory?time_interval=hour"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoDemandHistory?time_interval=day"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoDemandHistory?time_interval=hour"
 *
 * Expected Response:
 * [{"timestamp_utc":"2025-02-25T02:30:00.000Z","timestamp_tz":"2025-02-25T02:30:00.000Z","real_power_w":1935436,"reactive_power_var":742491}, ...]
 * ---------------------------------------------------------------------------
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoDemandHistory', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const timeInterval = request.query.get('time_interval');
        context.log(`Received time_interval: ${timeInterval}`);

        let query;
        if (timeInterval === 'hour') {
            query = `
                -- Define the user_id and powermeter serial_number
                WITH user_access AS (
                    SELECT 
                        1
                    FROM 
                        demo.powermeters p
                    JOIN 
                        demo.user_installations ui ON p.installation_id = ui.installation_id
                    WHERE 
                        ui.user_id = '4c7c56fe-99fc-4611-b57a-0d5683f9bc95' -- Replace with the actual user_id
                        AND p.serial_number = 'DEMO000001' -- Replace with the actual serial_number
                ),
                powermeter_time_zone AS (
                    SELECT 
                        time_zone
                    FROM 
                        demo.powermeters
                    WHERE 
                        serial_number = 'DEMO000001' -- Replace with the actual serial_number
                )
                SELECT 
                    "timestamp_utc",
                    "timestamp_tz",
                    total_real_power AS real_power_w,
                    reactive_power_var AS reactive_power_var
                FROM 
                    demo.measurements
                WHERE 
                    serial_number = 'DEMO000001'
                    AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                    AND "timestamp_utc" > NOW() - INTERVAL '1 hour'
                    AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY 
                    "timestamp_utc" DESC;
            `;
        } else if (timeInterval === 'day') {
            query = `
                -- Define the user_id and powermeter serial_number
                WITH user_access AS (
                    SELECT 
                        1
                    FROM 
                        demo.powermeters p
                    JOIN 
                        demo.user_installations ui ON p.installation_id = ui.installation_id
                    WHERE 
                        ui.user_id = '4c7c56fe-99fc-4611-b57a-0d5683f9bc95' -- Replace with the actual user_id
                        AND p.serial_number = 'DEMO000001' -- Replace with the actual serial_number
                ),
                powermeter_time_zone AS (
                    SELECT 
                        time_zone
                    FROM 
                        demo.powermeters
                    WHERE 
                        serial_number = 'DEMO000001' -- Replace with the actual serial_number
                )
                SELECT 
                    "timestamp_utc",
                    "timestamp_tz",
                    total_real_power AS real_power_w,
                    reactive_power_var AS reactive_power_var
                FROM 
                    demo.measurements
                WHERE 
                    serial_number = 'DEMO000001'
                    AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                    AND "timestamp_utc" > NOW() - INTERVAL '24 hours'
                    AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY 
                    "timestamp_utc" DESC;
            `;
        } else {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'Invalid time_interval value' })
            };
        }

        try {
            const client = await getClient();  // Reuse the connected client from dbClient.js

            context.log(`Executing query`);
            const res = await client.query(query);
            client.release(); // Release client back to the pool

            context.log("Database query executed successfully");

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