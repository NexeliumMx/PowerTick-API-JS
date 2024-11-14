const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

app.http('demoPostAcurev-1313-5a-x0Reading', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Parse the JSON payload
        const data = await request.json();

        // Validate required fields
        if (!data.serial_number || !data.timestamp) {
            return {
                status: 400,
                body: JSON.stringify({ message: "serial_number and timestamp are required fields." })
            };
        }

        // Insert query for demo.measurements table
        const query = `
            INSERT INTO demo.measurements (
                timestamp,
                serial_number,
                amps_total,
                amps_phase_a,
                amps_phase_b,
                amps_phase_c,
                voltage_ln_average,
                phase_voltage_an,
                phase_voltage_bn,
                phase_voltage_cn,
                voltage_ll_average,
                phase_voltage_ab,
                phase_voltage_bc,
                phase_voltage_ca,
                frequency,
                total_real_power,
                watts_phase_a,
                watts_phase_b,
                watts_phase_c,
                ac_apparent_power_va,
                va_phase_a,
                va_phase_b,
                va_phase_c,
                reactive_power_var,
                var_phase_a,
                var_phase_b,
                var_phase_c,
                power_factor,
                pf_phase_a,
                pf_phase_b,
                pf_phase_c,
                total_real_energy_exported,
                total_watt_hours_exported_in_phase_a,
                total_watt_hours_exported_in_phase_b,
                total_watt_hours_exported_in_phase_c,
                total_real_energy_imported,
                total_watt_hours_imported_phase_a,
                total_watt_hours_imported_phase_b,
                total_watt_hours_imported_phase_c,
                total_va_hours_exported,
                total_va_hours_exported_phase_a,
                total_va_hours_exported_phase_b,
                total_va_hours_exported_phase_c,
                total_va_hours_imported,
                total_va_hours_imported_phase_a,
                total_va_hours_imported_phase_b,
                total_va_hours_imported_phase_c,
                total_var_hours_imported_q1,
                total_var_hours_imported_q1_phase_a,
                total_var_hours_imported_q1_phase_b,
                total_var_hours_imported_q1_phase_c,
                total_var_hours_imported_q2,
                total_var_hours_imported_q2_phase_a,
                total_var_hours_imported_q2_phase_b,
                total_var_hours_imported_q2_phase_c,
                total_var_hours_exported_q3,
                total_var_hours_exported_q3_phase_a,
                total_var_hours_exported_q3_phase_b,
                total_var_hours_exported_q3_phase_c,
                total_var_hours_exported_q4,
                total_var_hours_exported_q4_phase_a,
                total_var_hours_exported_q4_phase_b,
                total_var_hours_exported_q4_phase_c
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
                $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
                $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63
            )
        `;

        // Array of values to match the placeholders in the SQL query
        const values = [
            data.timestamp, data.serial_number, data.amps_total, data.amps_phase_a, data.amps_phase_b, data.amps_phase_c,
            data.voltage_ln_average, data.phase_voltage_an, data.phase_voltage_bn, data.phase_voltage_cn, data.voltage_ll_average,
            data.phase_voltage_ab, data.phase_voltage_bc, data.phase_voltage_ca, data.frequency, data.total_real_power,
            data.watts_phase_a, data.watts_phase_b, data.watts_phase_c, data.ac_apparent_power_va, data.va_phase_a,
            data.va_phase_b, data.va_phase_c, data.reactive_power_var, data.var_phase_a, data.var_phase_b, data.var_phase_c,
            data.power_factor, data.pf_phase_a, data.pf_phase_b, data.pf_phase_c, data.total_real_energy_exported,
            data.total_watt_hours_exported_in_phase_a, data.total_watt_hours_exported_in_phase_b, data.total_watt_hours_exported_in_phase_c,
            data.total_real_energy_imported, data.total_watt_hours_imported_phase_a, data.total_watt_hours_imported_phase_b,
            data.total_watt_hours_imported_phase_c, data.total_va_hours_exported, data.total_va_hours_exported_phase_a,
            data.total_va_hours_exported_phase_b, data.total_va_hours_exported_phase_c, data.total_va_hours_imported,
            data.total_va_hours_imported_phase_a, data.total_va_hours_imported_phase_b, data.total_va_hours_imported_phase_c,
            data.total_var_hours_imported_q1, data.total_var_hours_imported_q1_phase_a, data.total_var_hours_imported_q1_phase_b,
            data.total_var_hours_imported_q1_phase_c, data.total_var_hours_imported_q2, data.total_var_hours_imported_q2_phase_a,
            data.total_var_hours_imported_q2_phase_b, data.total_var_hours_imported_q2_phase_c, data.total_var_hours_exported_q3,
            data.total_var_hours_exported_q3_phase_a, data.total_var_hours_exported_q3_phase_b, data.total_var_hours_exported_q3_phase_c,
            data.total_var_hours_exported_q4, data.total_var_hours_exported_q4_phase_a, data.total_var_hours_exported_q4_phase_b,
            data.total_var_hours_exported_q4_phase_c
        ];

        try {
            // Get the database client and execute the query
            const client = await getClient();
            await client.query(query, values);
            client.release(); // Release client back to the pool

            // Return success response
            return {
                status: 200,
                body: JSON.stringify({ message: "Data successfully inserted." })
            };
        } catch (error) {
            context.log.error("Error inserting data:", error);
            return {
                status: 500,
                body: JSON.stringify({ message: "Error inserting data.", error: error.message })
            };
        }
    }
});