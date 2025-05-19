/**
 * FileName: src/functions/demoConsumptionProfile.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch power consumption profile data for a specific powermeter in the demo schema.
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch power consumption profile data for a specific powermeter in the demo schema.
 * It verifies that the user has access to the powermeter and then retrieves the consumption profile data based on the specified time interval.
 * The function obtains its queries from the files in:
 *    PowerTick-backend/postgresql/dataQueries/consumptionProfile
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
 * 4. Query Execution: It executes a query to fetch the consumption profile data for the specified powermeter and time interval, 
 *    ensuring that the user has access to the powermeter.
 *
 * 5. Response: The function returns the query results as a JSON response with a status code of 200 
 *    if successful. If there is an error, it returns a status code of 500 with an error message.
 * ---------------------------------------------------------------------------
 * Example:
 * Fetch consumption profile data for a powermeter:
 * Local:
 *    curl -i -X GET "http://localhost:7071/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day&year=2025&month=02&day=25&hour=02"
 *    curl -i -X GET "http://localhost:7071/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month&year=2025&month=02&day=25&hour=02"" 
 *    curl -i -X GET "http://localhost:7071/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year&year=2025&month=02&day=25&hour=02""
 * Production:
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/demoConsumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year"
 *
 * Expected Response:
 * [{"consumption_profile_hour_range_utc":"2025-02-23 23-00","consumption_profile_hour_range_tz":"2025-02-23 17-18","real_energy_wh":12345,"reactive_energy_varh":6789}, ...]
 * --------------------------------------------------------------------------- 
*/

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoConsumptionProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        const serialNumber = request.query.get('serial_number');
        const timeInterval = request.query.get('time_interval');
        const year = request.query.get('year');
        const month = request.query.get('month');
        const day = request.query.get('day');
        const hour = request.query.get('hour');
let startTimestamp, endTimestamp;

if (timeInterval === 'hour' && year && month && day && hour) {
    startTimestamp = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:00:00Z`);
    endTimestamp = new Date(startTimestamp.getTime() + 60 * 60 * 1000);
} else if (timeInterval === 'day' && year && month && day) {
    startTimestamp = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    endTimestamp = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59Z`);
} else if (timeInterval === 'month' && year && month) {
    startTimestamp = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00Z`);
    // Get the first day of the next month
    endTimestamp = new Date(`${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01T00:00:00Z`);
} else if (timeInterval === 'year' && year) {
    startTimestamp = new Date(`${year}-01-01T00:00:00Z`);
    endTimestamp = new Date(`${parseInt(year) + 1}-01-01T00:00:00Z`);
} else {
    return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Missing or invalid date parameters' })
    };
}

        context.log(`Received user_id: ${userId}, serial_number: ${serialNumber}, time_interval: ${timeInterval}`);

        if (!userId || !serialNumber || !timeInterval|| !startTimestamp|| !endTimestamp) {
            context.log('user_id, serial_number, time filter, or time_interval is missing in the request');
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
    SELECT 1
    FROM demo.powermeters p
    JOIN demo.user_installations ui ON p.installation_id = ui.installation_id
    WHERE ui.user_id = $1
      AND p.serial_number = $2
),
powermeter_time_zone AS (
    SELECT time_zone
    FROM demo.powermeters
    WHERE serial_number = $2
),
last_entries AS (
    SELECT 
        "timestamp_tz", 
        "timestamp_utc",
        kwh_imported_total, 
        varh_imported_q1,
        date_trunc('hour', "timestamp_tz") AS hour,
        date_trunc('hour', "timestamp_utc") AS hour_utc
    FROM demo.measurements
    WHERE 
        serial_number = $2
        AND "timestamp_utc" >= $3 AND "timestamp_utc" < $4
        AND EXISTS (SELECT 1 FROM user_access)
    ORDER BY "timestamp_tz" DESC
),
hourly_data AS (
    SELECT DISTINCT ON (hour)
        hour,
        hour_utc,
        "timestamp_tz",
        kwh_imported_total,
        varh_imported_q1
    FROM last_entries
    ORDER BY hour, "timestamp_tz" DESC
),
previous_hour_data AS (
    SELECT 
        hour,
        LAG(kwh_imported_total) OVER (ORDER BY hour) AS prev_real_energy_imported,
        LAG(varh_imported_q1) OVER (ORDER BY hour) AS prev_var_hours_imported
    FROM hourly_data
)
SELECT 
    TO_CHAR(hd.hour_utc, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour_utc + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_utc,
    TO_CHAR(hd.hour, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_tz,
    hd.kwh_imported_total - phd.prev_real_energy_imported AS real_energy_wh,
    hd.varh_imported_q1 - phd.prev_var_hours_imported AS reactive_energy_varh
FROM hourly_data hd
JOIN previous_hour_data phd ON hd.hour = phd.hour
ORDER BY hd.hour DESC;
            `;
        } else if (timeInterval === 'month') {
            query = `
               -- Define the user_id and powermeter serial_number
                  WITH user_access AS (
    SELECT 1
    FROM demo.powermeters p
    JOIN demo.user_installations ui ON p.installation_id = ui.installation_id
    WHERE ui.user_id = $1
      AND p.serial_number = $2
),
powermeter_time_zone AS (
    SELECT time_zone
    FROM demo.powermeters
    WHERE serial_number = $2
),
last_entries AS (
    SELECT 
        "timestamp_tz", 
        "timestamp_utc",
        kwh_imported_total, 
        varh_imported_q1,
        date_trunc('hour', "timestamp_tz") AS hour,
        date_trunc('hour', "timestamp_utc") AS hour_utc
    FROM demo.measurements
    WHERE 
        serial_number = $2
        AND "timestamp_utc" >= $3 AND "timestamp_utc" < $4
        AND EXISTS (SELECT 1 FROM user_access)
    ORDER BY "timestamp_tz" DESC
),
hourly_data AS (
    SELECT DISTINCT ON (hour)
        hour,
        hour_utc,
        "timestamp_tz",
        kwh_imported_total,
        varh_imported_q1
    FROM last_entries
    ORDER BY hour, "timestamp_tz" DESC
),
previous_hour_data AS (
    SELECT 
        hour,
        LAG(kwh_imported_total) OVER (ORDER BY hour) AS prev_real_energy_imported,
        LAG(varh_imported_q1) OVER (ORDER BY hour) AS prev_var_hours_imported
    FROM hourly_data
)
SELECT 
    TO_CHAR(hd.hour_utc, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour_utc + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_utc,
    TO_CHAR(hd.hour, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_tz,
    hd.kwh_imported_total - phd.prev_real_energy_imported AS real_energy_wh,
    hd.varh_imported_q1 - phd.prev_var_hours_imported AS reactive_energy_varh
FROM hourly_data hd
JOIN previous_hour_data phd ON hd.hour = phd.hour
ORDER BY hd.hour DESC;            `;
        } else if (timeInterval === 'year') {
            query = `
         -- Define the user_id and powermeter serial_number
                  WITH user_access AS (
    SELECT 1
    FROM demo.powermeters p
    JOIN demo.user_installations ui ON p.installation_id = ui.installation_id
    WHERE ui.user_id = $1
      AND p.serial_number = $2
),
powermeter_time_zone AS (
    SELECT time_zone
    FROM demo.powermeters
    WHERE serial_number = $2
),
last_entries AS (
    SELECT 
        "timestamp_tz", 
        "timestamp_utc",
        kwh_imported_total, 
        varh_imported_q1,
        date_trunc('hour', "timestamp_tz") AS hour,
        date_trunc('hour', "timestamp_utc") AS hour_utc
    FROM demo.measurements
    WHERE 
        serial_number = $2
        AND "timestamp_utc" >= $3 AND "timestamp_utc" < $4
        AND EXISTS (SELECT 1 FROM user_access)
    ORDER BY "timestamp_tz" DESC
),
hourly_data AS (
    SELECT DISTINCT ON (hour)
        hour,
        hour_utc,
        "timestamp_tz",
        kwh_imported_total,
        varh_imported_q1
    FROM last_entries
    ORDER BY hour, "timestamp_tz" DESC
),
previous_hour_data AS (
    SELECT 
        hour,
        LAG(kwh_imported_total) OVER (ORDER BY hour) AS prev_real_energy_imported,
        LAG(varh_imported_q1) OVER (ORDER BY hour) AS prev_var_hours_imported
    FROM hourly_data
)
SELECT 
    TO_CHAR(hd.hour_utc, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour_utc + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_utc,
    TO_CHAR(hd.hour, 'YYYY-MM-DD HH24') || '-' || TO_CHAR(hd.hour + INTERVAL '1 hour', 'HH24') AS consumption_profile_hour_range_tz,
    hd.kwh_imported_total - phd.prev_real_energy_imported AS real_energy_wh,
    hd.varh_imported_q1 - phd.prev_var_hours_imported AS reactive_energy_varh
FROM hourly_data hd
JOIN previous_hour_data phd ON hd.hour = phd.hour
ORDER BY hd.hour DESC;
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

            const values = [userId, serialNumber, startTimestamp.toISOString(), endTimestamp.toISOString()];
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