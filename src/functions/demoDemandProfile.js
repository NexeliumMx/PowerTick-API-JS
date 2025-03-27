/**
 * FileName: src/functions/demoDemandProfile.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch power demand profile data for a specific powermeter in the demo schema.
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch power demand profile data for a specific powermeter in the demo schema.
 * It verifies that the user has access to the powermeter and then retrieves the demand profile data based on the specified time interval.
 * The function obtains its queries from the files in:
 *    PowerTick-backend/postgresql/dataQueries/demandProfile
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameters: The function expects query parameters `user_id`, `serial_number`, and `time_interval` to identify the user, powermeter, and time interval.
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Schema Setting: The function sets the search path to the desired schema (`demo`).
 *
 * 4. Query Execution: It executes a query to fetch the demand profile data for the specified powermeter and time interval, 
 *    ensuring that the user has access to the powermeter.
 *
 * 5. Response: The function returns the query results as a JSON response with a status code of 200 
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch demand profile data for a powermeter:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 *    curl -i -X GET "http://localhost:7071/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month" 
 *    curl -i -X GET "http://localhost:7071/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year"
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoDemandProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year"
 *
 * Expected Response:
 * [{"demand_profile_hour_range_utc":"2025-02-23 23-00","demand_profile_hour_range_tz":"2025-02-23 17-18","avg_real_power_w":123.45,"max_real_power_w":150.67,"avg_var":67.89,"max_var":80.12}, ...]
 * --------------------------------------------------------------------------- 
*/

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoDemandProfile', {
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
        if (timeInterval === 'day') {
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
                ),
                hourly_data AS (
                    SELECT 
                        date_trunc('hour', "timestamp_tz") AS hour,
                        date_trunc('hour', "timestamp_utc") AS hour_utc,
                        AVG(watts) AS avg_watts,
                        MAX(watts) AS max_watts,
                        AVG(var) AS avg_var,
                        MAX(var) AS max_var
                    FROM 
                        demo.measurements
                    WHERE 
                        serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    GROUP BY 
                        date_trunc('hour', "timestamp_tz"), date_trunc('hour', "timestamp_utc")
                )
                SELECT 
                    TO_CHAR(hour_utc, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hour_utc + INTERVAL '1 hour', 'HH24') AS demand_profile_hour_range_utc,
                    TO_CHAR(hour, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hour + INTERVAL '1 hour', 'HH24') AS demand_profile_hour_range_tz,
                    avg_watts AS avg_real_power_w,
                    max_watts AS max_real_power_w,
                    avg_var,
                    max_var
                FROM 
                    hourly_data
                WHERE 
                    hour >= date_trunc('hour', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '24 hours'
                ORDER BY 
                    hour DESC;
            `;
        } else if (timeInterval === 'month') {
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
                ),
                daily_data AS (
                    SELECT 
                        date_trunc('day', "timestamp_tz") AS day,
                        AVG(watts) AS avg_watts,
                        MAX(watts) AS max_watts,
                        AVG(var) AS avg_var,
                        MAX(var) AS max_var
                    FROM 
                        demo.measurements
                    WHERE 
                        serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    GROUP BY 
                        date_trunc('day', "timestamp_tz")
                )
                SELECT 
                    TO_CHAR(day, 'YYYY-MM-DD') AS demand_profile_day_range_tz,
                    avg_watts AS avg_real_power_w,
                    max_watts AS max_real_power_w,
                    avg_var,
                    max_var
                FROM 
                    daily_data
                WHERE 
                    day >= date_trunc('day', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '30 days'
                ORDER BY 
                    day DESC;
            `;
        } else if (timeInterval === 'year') {
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
                ),
                monthly_data AS (
                    SELECT 
                        date_trunc('month', "timestamp_tz") AS month,
                        AVG(watts) AS avg_watts,
                        MAX(watts) AS max_watts,
                        AVG(var) AS avg_var,
                        MAX(var) AS max_var
                    FROM 
                        demo.measurements
                    WHERE 
                        serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    GROUP BY 
                        date_trunc('month', "timestamp_tz")
                )
                SELECT 
                    TO_CHAR(month, 'YYYY-MM') AS demand_profile_day_range_tz,
                    avg_watts AS avg_real_power_w,
                    max_watts AS max_real_power_w,
                    avg_var,
                    max_var
                FROM 
                    monthly_data
                WHERE 
                    month >= date_trunc('month', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '12 months'
                ORDER BY 
                    month DESC;
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