/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 2024-11-21
 *
 * This function serves as an HTTP GET endpoint to retrieve the maximum demand (total_real_power 
 * and reactive_power_var) for a specific powermeter based on the provided serial number (`sn`) and 
 * time range (`time`). The time range can be `year`, `month`, or `day`, and the function dynamically 
 * determines the time zone for the powermeter based on its configuration in the `demo.powermeters` table.
 *
 * ### Objective:
 * - Dynamically fetch the `time_zone` for the provided `sn` from the `demo.powermeters` table.
 * - Retrieve the maximum values of `total_real_power` and `reactive_power_var` within the specified 
 *   time range (year, month, or day) in the dynamically determined time zone.
 * - Return both results as a JSON array.
 *
 * ### Conditions:
 * - The `sn` (serial number) must exist in the `demo.powermeters` table.
 * - The `time` parameter must be one of `year`, `month`, or `day`.
 * - The queries are dynamically parameterized to support different time ranges and time zones.
 *
 * ### Example:
 * curl -X GET "http://localhost:7071/api/demoMaxDemand?sn=DEMO0000001&time=day"
 */

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoMaxDemand', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const serialNumber = request.query.get('sn');
        const time = request.query.get('time');

        if (!serialNumber || !time) {
            return {
                status: 400,
                body: {
                    error: "Missing required query parameters 'sn' (serial number) and 'time'."
                }
            };
        }

        if (!['year', 'month', 'day'].includes(time)) {
            return {
                status: 400,
                body: {
                    error: "Invalid 'time' parameter. Valid values are 'year', 'month', 'day'."
                }
            };
        }

        const client = await getClient();

        try {
            // Get the time zone for the given serial number
            const timeZoneQuery = `
                SELECT time_zone
                FROM demo.powermeters
                WHERE serial_number = $1
            `;
            const timeZoneResult = await client.query(timeZoneQuery, [serialNumber]);

            if (timeZoneResult.rows.length === 0) {
                return {
                    status: 404,
                    body: {
                        error: `No powermeter found with serial number '${serialNumber}'.`
                    }
                };
            }

            const timeZone = timeZoneResult.rows[0].time_zone;

            // Define time range based on 'time' parameter
            const dateTrunc = {
                year: 'year',
                month: 'month',
                day: 'day'
            }[time];

            // Queries for total_real_power and reactive_power_var
            const totalRealPowerQuery = `
                SELECT 
                  "timestamp",
                  total_real_power
                FROM demo.measurements
                WHERE serial_number = $1
                  AND "timestamp" AT TIME ZONE $2 >= date_trunc('${dateTrunc}', NOW() AT TIME ZONE $2)
                  AND "timestamp" AT TIME ZONE $2 < date_trunc('${dateTrunc}', NOW() AT TIME ZONE $2) + INTERVAL '1 ${dateTrunc}'
                  AND "timestamp" < NOW()
                ORDER BY total_real_power DESC
                LIMIT 1;
            `;

            const reactivePowerVarQuery = `
                SELECT 
                  "timestamp",
                  reactive_power_var
                FROM demo.measurements
                WHERE serial_number = $1
                  AND "timestamp" AT TIME ZONE $2 >= date_trunc('${dateTrunc}', NOW() AT TIME ZONE $2)
                  AND "timestamp" AT TIME ZONE $2 < date_trunc('${dateTrunc}', NOW() AT TIME ZONE $2) + INTERVAL '1 ${dateTrunc}'
                  AND "timestamp" < NOW()
                ORDER BY total_real_power DESC
                LIMIT 1;
            `;

            // Execute queries
            const totalRealPowerResult = await client.query(totalRealPowerQuery, [serialNumber, timeZone]);
            const reactivePowerVarResult = await client.query(reactivePowerVarQuery, [serialNumber, timeZone]);

            // Prepare response JSON
            const response = [
                {
                    type: "total_real_power",
                    data: totalRealPowerResult.rows.length > 0 ? totalRealPowerResult.rows[0] : null
                },
                {
                    type: "reactive_power_var",
                    data: reactivePowerVarResult.rows.length > 0 ? reactivePowerVarResult.rows[0] : null
                }
            ];

            // Return response
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response)
            };
        } catch (error) {
            context.log.error("Error executing queries:", error);
            return {
                status: 500,
                body: { error: "An error occurred while processing your request." }
            };
        } finally {
            client.release();
        }
    }
});