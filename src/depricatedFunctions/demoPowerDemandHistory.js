/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 20-11-2024
 *
 * This function serves as an HTTP GET endpoint to retrieve historic power demand data (W and VAr)
 * for a specific powermeter based on the provided serial number (SN) and time range.
 * It supports two time ranges:
 * - Hourly: Fetch data from the past hour.
 * - Yearly: Fetch the latest monthly data points for the past year.
 *
 * Example:
 * Query for the past hour:
 * curl -X GET "http://localhost:7071/api/demoPowerDemandHistory?sn=DEMO0000001&time=hour"
 *
 * Query for the past year:
 * curl -X GET "http://localhost:7071/api/demoPowerDemandHistory?sn=DEMO0000001&time=year"
 * 
 * PENDING TASKS:
 * Filter the results by highest power factor in yearly query.
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoPowerDemandHistory', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const serialNumber = request.query.get('sn');
            const timeRange = request.query.get('time');

            if (!serialNumber) {
                return {
                    status: 400,
                    body: { error: "Missing required query parameter 'sn'." }
                };
            }

            if (!timeRange || (timeRange !== 'hour' && timeRange !== 'year')) {
                return {
                    status: 400,
                    body: { error: "Invalid or missing 'time' query parameter. Expected 'hour' or 'year'." }
                };
            }

            const client = await getClient();

            // Query to get the time_zone for the given serial number
            const timeZoneQuery = `
                SELECT "time_zone"
                FROM "demo"."powermeters"
                WHERE "serial_number" = $1
            `;
            const timeZoneResult = await client.query(timeZoneQuery, [serialNumber]);

            if (timeZoneResult.rows.length === 0) {
                client.release();
                return {
                    status: 404,
                    body: { error: `No powermeter found with serial number '${serialNumber}'` }
                };
            }

            const timeZone = timeZoneResult.rows[0].time_zone;

            let query;
            if (timeRange === 'hour') {
                // Original query for hourly data
                query = `
                    SELECT
                        "timestamp",
                        "total_real_power",
                        "reactive_power_var"
                    FROM "demo"."measurements"
                    WHERE "serial_number" = $1
                      AND "timestamp" >= NOW() - INTERVAL '1 hour' - INTERVAL '5 minutes'
                      AND "timestamp" < NOW()
                    ORDER BY "timestamp" DESC;
                `;
            } else if (timeRange === 'year') {
                query = `
                    WITH monthly_latest AS (
                        SELECT
                            date_trunc('month', "timestamp" AT TIME ZONE $2) AS month_start,
                            MAX("timestamp" AT TIME ZONE $2) AT TIME ZONE $2 AS latest_timestamp
                        FROM "demo"."measurements"
                        WHERE "serial_number" = $1
                          AND "timestamp" < NOW()
                        GROUP BY date_trunc('month', "timestamp" AT TIME ZONE $2)
                        ORDER BY month_start DESC
                        LIMIT 12
                    )
                    SELECT
                        ml.latest_timestamp AS "timestamp",
                        m."total_real_power",
                        m."reactive_power_var"
                    FROM monthly_latest ml
                    JOIN "demo"."measurements" m
                    ON ml.latest_timestamp = m."timestamp" AT TIME ZONE $2
                    WHERE m."serial_number" = $1
                    ORDER BY ml.latest_timestamp DESC;

                `;
            }

            const queryParams = timeRange === 'hour' ? [serialNumber] : [serialNumber, timeZone];
            const result = await client.query(query, queryParams);
            client.release();

            // Return serialized JSON response
            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(result.rows)
            };
        } catch (error) {
            context.log.error("Error executing query:", error);
            return {
                status: 500,
                body: { error: "An error occurred while processing your request." }
            };
        }
    }
});