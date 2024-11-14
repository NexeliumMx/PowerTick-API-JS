const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoRealtimeData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Get the serial number from the query parameters
        const serialNumber = request.query.get('sn');
        if (!serialNumber) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Serial number is required in the query parameters.' })
            };
        }

        // Get a pooled client from the connection pool
        const client = await getClient();

        const query = `
            SELECT
                "timestamp",
                "serial_number",
                "amps_total",
                "amps_phase_a",
                "amps_phase_b",
                "amps_phase_c",
                "voltage_ln_average",
                "phase_voltage_an",
                "phase_voltage_bn",
                "phase_voltage_cn",
                "voltage_ll_average",
                "phase_voltage_ab",
                "phase_voltage_bc",
                "phase_voltage_ca",
                "frequency",
                "total_real_power",
                "watts_phase_a",
                "watts_phase_b",
                "watts_phase_c",
                "ac_apparent_power_va",
                "va_phase_a",
                "va_phase_b",
                "va_phase_c",
                "reactive_power_var",
                "var_phase_a",
                "var_phase_b",
                "var_phase_c",
                "power_factor",
                "pf_phase_a",
                "pf_phase_b",
                "pf_phase_c",
                "total_real_energy_exported",
                "total_watt_hours_exported_in_phase_a",
                "total_watt_hours_exported_in_phase_b",
                "total_watt_hours_exported_in_phase_c",
                "total_real_energy_imported",
                "total_watt_hours_imported_phase_a",
                "total_watt_hours_imported_phase_b",
                "total_watt_hours_imported_phase_c",
                "total_va_hours_exported",
                "total_va_hours_exported_phase_a",
                "total_va_hours_exported_phase_b",
                "total_va_hours_exported_phase_c",
                "total_va_hours_imported",
                "total_va_hours_imported_phase_a",
                "total_va_hours_imported_phase_b",
                "total_va_hours_imported_phase_c",
                "total_var_hours_imported_q1",
                "total_var_hours_imported_q1_phase_a",
                "total_var_hours_imported_q1_phase_b",
                "total_var_hours_imported_q1_phase_c",
                "total_var_hours_imported_q2",
                "total_var_hours_imported_q2_phase_a",
                "total_var_hours_imported_q2_phase_b",
                "total_var_hours_imported_q2_phase_c",
                "total_var_hours_exported_q3",
                "total_var_hours_exported_q3_phase_a",
                "total_var_hours_exported_q3_phase_b",
                "total_var_hours_exported_q3_phase_c",
                "total_var_hours_exported_q4",
                "total_var_hours_exported_q4_phase_a",
                "total_var_hours_exported_q4_phase_b",
                "total_var_hours_exported_q4_phase_c"
            FROM "demo"."measurements"
            WHERE "serial_number" = $1
                AND "timestamp" <= DATE_TRUNC('minute', NOW() AT TIME ZONE 'UTC')
            ORDER BY "timestamp" DESC
            LIMIT 1;
        `;

        try {
            const res = await client.query(query, [serialNumber]);

            if (res.rows.length === 0) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'No real-time data found for the specified serial number.' })
                };
            }

            // Return the row data as JSON
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows[0])
            };
        } catch (error) {
            context.log.error('Error fetching real-time data:', error.stack);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Error fetching real-time data.' })
            };
        } finally {
            client.release(); // Release the client back to the pool
        }
    }
});