/**
 * FileName: src/functions/demoConsumptionHistory.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch power consumption history data for a specific powermeter in the demo schema.
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch power consumption history data for a specific powermeter in the demo schema.
 * It verifies that the user has access to the powermeter and then retrieves the consumption history data based on the specified time interval.
 * The function obtains its queries from the files in:
 *    PowerTick-backend/postgresql/dataQueries/consumptionHistory
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameters: The function expects query parameters `user_id`, `serial_number`, and `time_interval` to specify the user, powermeter, and time interval for the data retrieval.
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Query Execution: It executes a query to fetch the consumption history data for the specified powermeter and time interval,
 *    ensuring that the user has access to the powermeter.
 *
 * 4. Response: The function returns the query results as a JSON response with a status code of 200
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch consumption history data for a powermeter:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/demoConsumptionHistory?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=hour"
 *    curl -i -X GET "http://localhost:7071/api/demoConsumptionHistory?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionHistory?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=hour"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionHistory?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 *
 * Expected Response:
 * [{"timestamp_utc":"2025-02-25T02:30:00.000Z","timestamp_tz":"2025-02-25T02:30:00.000Z","real_energy_wh":1935436,"reactive_energy_varh":742491}, ...]
 * ---------------------------------------------------------------------------
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoConsumptionHistory', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        const serialNumber = request.query.get('serial_number');
        const timeInterval = request.query.get('time_interval');
        context.log(`Received user_id: ${userId}, serial_number: ${serialNumber}, time_interval: ${timeInterval}`);

        if (!userId || !serialNumber || !timeInterval) {
            context.log('user_id, serial_number, or time_interval is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'user_id, serial_number, and time_interval are required' })
            };
        }

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
                        ui.user_id = $1
                        AND p.serial_number = $2
                ),
                powermeter_time_zone AS (
                    SELECT 
                        time_zone
                    FROM 
                        demo.powermeters
                    WHERE 
                        serial_number = $2
                )
                SELECT 
                    "timestamp_utc",
                    "timestamp_tz",
                    kwh_imported_total AS real_energy_wh,
                    varh_imported_q1 AS reactive_energy_varh
                FROM 
                    demo.measurements
                WHERE 
                    serial_number = $2
                    AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                    AND "timestamp_utc" > NOW() - INTERVAL '1 hour'
                    AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY 
                    "timestamp_utc" ASC;
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
                        ui.user_id = $1
                        AND p.serial_number = $2
                ),
                powermeter_time_zone AS (
                    SELECT 
                        time_zone
                    FROM 
                        demo.powermeters
                    WHERE 
                        serial_number = $2
                )
                SELECT 
                    "timestamp_utc",
                    "timestamp_tz",
                    kwh_imported_total AS real_energy_wh,
                    varh_imported_q1 AS reactive_energy_varh
                FROM 
                    demo.measurements
                WHERE 
                    serial_number = $2
                    AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                    AND "timestamp_utc" > NOW() - INTERVAL '24 hours'
                    AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY 
                    "timestamp_utc" ASC;
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

            const values = [userId, serialNumber];
            context.log(`Executing query with values: ${values}`);
            const res = await client.query(query, values);
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