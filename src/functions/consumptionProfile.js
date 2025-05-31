/**
 * FileName: src/functions/consumptionProfile.js
 * Author(s): Arturo Vargas
 * Brief: HTTP GET endpoint to fetch power consumption profile data for a specific powermeter in the selected schema (production, dev, or demo).
 * Date: 2025-02-24
 *
 * Description:
 * This function serves as an HTTP GET endpoint to fetch power consumption profile data for a specific powermeter in the selected schema (production, dev, or demo).
 * It verifies that the user has access to the powermeter and then retrieves the consumption profile data based on the specified time interval.
 * The schema is selected via the `schema` query parameter (e.g., &schema=demo). If omitted or invalid, it defaults to 'production'.
 * The function obtains its queries from the files in:
 *    PowerTick-backend/postgresql/dataQueries/consumptionProfile
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * ---------------------------------------------------------------------------
 * Code Description:
 * 1. Query Parameters: The function expects query parameters `user_id`, `serial_number`, `time_interval`, and optional `schema` (defaults to 'production').
 *
 * 2. Database Connection: It connects to the PostgreSQL database using a client from dbClient.js.
 *
 * 3. Schema Selection: The function uses the `schema` query parameter to select the schema (`production`, `dev`, or `demo`). If omitted or invalid, defaults to `production`.
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
 *    curl -i -X GET "http://localhost:7071/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day&schema=demo"
 *    curl -i -X GET "http://localhost:7071/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month&schema=demo" 
 *    curl -i -X GET "http://localhost:7071/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year&schema=demo"
 * Production (schema omitted, defaults to production):
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=day"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=month"
 *    curl -i -X GET "https://power-tick-api-js.nexelium.mx/api/consumptionProfile?user_id=4c7c56fe-99fc-4611-b57a-0d5683f9bc95&serial_number=DEMO000001&time_interval=year"
 *
 * Expected Response:
 * [{"consumption_profile_hour_range_utc":"2025-02-23 23-00","consumption_profile_hour_range_tz":"2025-02-23 17-18","real_energy_wh":12345,"reactive_energy_varh":6789}, ...]
 * --------------------------------------------------------------------------- 
*/

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('consumptionProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        const serialNumber = request.query.get('serial_number');
        const timeInterval = request.query.get('time_interval');
        let schema = request.query.get('schema');
        if (!schema || !['production', 'dev', 'demo'].includes(schema)) {
            schema = 'production';
        }
        context.log(`Received user_id: ${userId}, serial_number: ${serialNumber}, time_interval: ${timeInterval}, schema: ${schema}`);

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
                WITH user_access AS (
                    SELECT 1
                    FROM ${schema}.powermeters p
                    JOIN ${schema}.user_installations ui ON p.installation_id = ui.installation_id
                    WHERE ui.user_id = $1 AND p.serial_number = $2
                ),
                powermeter_time_zone AS (
                    SELECT time_zone FROM ${schema}.powermeters WHERE serial_number = $2
                ),
                last_entries AS (
                    SELECT "timestamp_tz", "timestamp_utc", kwh_imported_total, varh_imported_q1, date_trunc('hour', "timestamp_tz") AS hour, date_trunc('hour', "timestamp_utc") AS hour_utc
                    FROM ${schema}.measurements
                    WHERE serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    ORDER BY "timestamp_tz" DESC
                ),
                hourly_data AS (
                    SELECT DISTINCT ON (hour) hour, hour_utc, "timestamp_tz", kwh_imported_total, varh_imported_q1
                    FROM last_entries
                    ORDER BY hour, "timestamp_tz" DESC
                ),
                previous_hour_data AS (
                    SELECT hour, LAG(kwh_imported_total) OVER (ORDER BY hour) AS prev_real_energy_imported, LAG(varh_imported_q1) OVER (ORDER BY hour) AS prev_var_hours_imported
                    FROM hourly_data
                )
                SELECT TO_CHAR(hd.hour_utc, 'YYYY-MM-DD HH24:00') || '-' || TO_CHAR(hd.hour_utc + INTERVAL '1 hour', 'HH24:00') AS consumption_profile_hour_range_utc,
                       TO_CHAR(hd.hour, 'YYYY-MM-DD HH24:00') || '-' || TO_CHAR(hd.hour + INTERVAL '1 hour', 'HH24:00') AS consumption_profile_hour_range_tz,
                       hd.kwh_imported_total - phd.prev_real_energy_imported AS real_energy_wh,
                       hd.varh_imported_q1 - phd.prev_var_hours_imported AS reactive_energy_varh
                FROM hourly_data hd
                JOIN previous_hour_data phd ON hd.hour = phd.hour
                WHERE hd.hour >= date_trunc('hour', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '24 hours'
                ORDER BY hd.hour ASC;
            `;
        } else if (timeInterval === 'month') {
            query = `
                WITH user_access AS (
                    SELECT 1
                    FROM ${schema}.powermeters p
                    JOIN ${schema}.user_installations ui ON p.installation_id = ui.installation_id
                    WHERE ui.user_id = $1 AND p.serial_number = $2
                ),
                powermeter_time_zone AS (
                    SELECT time_zone FROM ${schema}.powermeters WHERE serial_number = $2
                ),
                last_entries AS (
                    SELECT "timestamp_tz", kwh_imported_total, varh_imported_q1, date_trunc('day', "timestamp_tz") AS day
                    FROM ${schema}.measurements
                    WHERE serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    ORDER BY "timestamp_tz" DESC
                ),
                daily_data AS (
                    SELECT DISTINCT ON (day) day, "timestamp_tz", kwh_imported_total, varh_imported_q1
                    FROM last_entries
                    ORDER BY day, "timestamp_tz" DESC
                ),
                previous_day_data AS (
                    SELECT day, LAG(kwh_imported_total) OVER (ORDER BY day) AS prev_real_energy_imported, LAG(varh_imported_q1) OVER (ORDER BY day) AS prev_var_hours_imported
                    FROM daily_data
                )
                SELECT TO_CHAR(dd.day, 'YYYY-MM-DD') AS consumption_profile_day_range_tz,
                       dd.kwh_imported_total - pdd.prev_real_energy_imported AS real_energy_wh,
                       dd.varh_imported_q1 - pdd.prev_var_hours_imported AS reactive_energy_varh
                FROM daily_data dd
                JOIN previous_day_data pdd ON dd.day = pdd.day
                WHERE dd.day >= date_trunc('day', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '30 days'
                ORDER BY dd.day ASC;
            `;
        } else if (timeInterval === 'year') {
            query = `
                WITH user_access AS (
                    SELECT 1
                    FROM ${schema}.powermeters p
                    JOIN ${schema}.user_installations ui ON p.installation_id = ui.installation_id
                    WHERE ui.user_id = $1 AND p.serial_number = $2
                ),
                powermeter_time_zone AS (
                    SELECT time_zone FROM ${schema}.powermeters WHERE serial_number = $2
                ),
                last_entries AS (
                    SELECT "timestamp_tz", kwh_imported_total, varh_imported_q1, date_trunc('month', "timestamp_tz") AS month
                    FROM ${schema}.measurements
                    WHERE serial_number = $2
                        AND "timestamp_tz" < NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)
                        AND EXISTS (SELECT 1 FROM user_access)
                    ORDER BY "timestamp_tz" DESC
                ),
                monthly_data AS (
                    SELECT DISTINCT ON (month) month, "timestamp_tz", kwh_imported_total, varh_imported_q1
                    FROM last_entries
                    ORDER BY month, "timestamp_tz" DESC
                ),
                previous_month_data AS (
                    SELECT month, LAG(kwh_imported_total) OVER (ORDER BY month) AS prev_real_energy_imported, LAG(varh_imported_q1) OVER (ORDER BY month) AS prev_var_hours_imported
                    FROM monthly_data
                )
                SELECT TO_CHAR(md.month, 'YYYY-MM') AS consumption_profile_month_range_tz,
                       md.kwh_imported_total - pmd.prev_real_energy_imported AS real_energy_wh,
                       md.varh_imported_q1 - pmd.prev_var_hours_imported AS reactive_energy_varh
                FROM monthly_data md
                JOIN previous_month_data pmd ON md.month = pmd.month
                WHERE md.month >= date_trunc('month', NOW() AT TIME ZONE (SELECT time_zone FROM powermeter_time_zone)) - INTERVAL '12 months'
                ORDER BY md.month ASC;
            `;
        } else {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'Invalid time_interval value' })
            };
        }

        try {
            const client = await getClient();
            const values = [userId, serialNumber];
            context.log(`Executing query with values: ${values}`);
            const res = await client.query(query, values);
            client.release();
            context.log("Database query executed successfully");
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