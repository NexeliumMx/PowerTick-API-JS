/**
 * File: thdCurrentProfile.js
 * Author(s): Arturo Vargas
 * Endpoint: /api/thdCurrentProfile
 * Brief: Returns grouped THD current profile (hourly, daily, or monthly) for a powermeter, validating user access and UTC range.
 * Date: 2025-06-23
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 * 
 * Parameters:
 *   - user_id (required)
 *   - powermeter_id (required)
 *   - time_interval: 'hour' | 'day' | 'month' (required)
 *   - start_utc (required, ISO string)
 *   - end_utc (required, ISO string)
 *   - enviroment: 'production' | 'demo' | 'dev' (optional)
 */

const { app } = require('@azure/functions');
const { executeQuery } = require('../dbClient');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];
const TIME_INTERVALS = ['hour', 'day', 'month'];

app.http('thdCurrentProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // --- Parse and Validate Params ---
        const user_id = request.query.get('user_id');
        const powermeter_id = request.query.get('powermeter_id');
        const time_interval = request.query.get('time_interval');
        const start_utc = request.query.get('start_utc');
        const end_utc = request.query.get('end_utc');
        let enviroment = request.query.get('enviroment') || 'production';

        // SQL injection protection
        if (!ALLOWED_ENVIROMENTS.includes(enviroment)) {
            return { status: 400, body: JSON.stringify({ error: "Invalid enviroment" }) };
        }
        if (!TIME_INTERVALS.includes(time_interval)) {
            return { status: 400, body: JSON.stringify({ error: "Invalid time_interval" }) };
        }

        // Schema selection
        let schema = 'public';
        if (enviroment === 'demo') schema = 'demo';
        else if (enviroment === 'dev') schema = 'dev';

        // Validate required parameters
        if (!user_id || !powermeter_id || !start_utc || !end_utc) {
            return { status: 400, body: JSON.stringify({ error: "Missing required parameter" }) };
        }

        // --- Build dynamic SQL ---
        const ctes = `
            authorized_powermeter AS (
                SELECT p.powermeter_id, p.time_zone
                FROM ${schema}.powermeters p
                JOIN public.user_installations ui ON p.installation_id = ui.installation_id
                WHERE ui.user_id = $2
                  AND p.powermeter_id = $1
            ),
            powermeter_info AS (
                SELECT
                    powermeter_id,
                    time_zone,
                    EXTRACT(hour FROM ('1970-01-01 00:00:00' AT TIME ZONE time_zone)
                        - '1970-01-01 00:00:00'::timestamp) AS offset_hours
                FROM authorized_powermeter
            )`;

        let selectQuery;
        if (time_interval === 'hour') {
            selectQuery = `
                SELECT
                    time_bucket(
                        '1 hour',
                        m."timestamp",
                        ('1970-01-01 ' || LPAD((0 - pi.offset_hours)::text, 2, '0') || ':00:00+00')::timestamptz
                    ) AS hour_start_utc,
                    max(m.thd_current_l1) AS thd_current_l1_max,
                    avg(m.thd_current_l1) AS thd_current_l1_avg,
                    max(m.thd_current_l2) AS thd_current_l2_max,
                    avg(m.thd_current_l2) AS thd_current_l2_avg,
                    max(m.thd_current_l3) AS thd_current_l3_max,
                    avg(m.thd_current_l3) AS thd_current_l3_avg
                FROM ${schema}.measurements m
                JOIN powermeter_info pi ON m.powermeter_id = pi.powermeter_id
                WHERE m."timestamp" >= $3
                  AND m."timestamp" <  $4
                  AND m."timestamp" <= NOW()
                GROUP BY hour_start_utc
                ORDER BY hour_start_utc ASC
            `;
        } else if (time_interval === 'day') {
            selectQuery = `
                SELECT
                    time_bucket(
                        '1 day',
                        m."timestamp",
                        ('1970-01-01 ' || LPAD((0 - pi.offset_hours)::text, 2, '0') || ':00:00+00')::timestamptz
                    ) AS day_start_utc,
                    max(m.thd_current_l1) AS thd_current_l1_max,
                    avg(m.thd_current_l1) AS thd_current_l1_avg,
                    max(m.thd_current_l2) AS thd_current_l2_max,
                    avg(m.thd_current_l2) AS thd_current_l2_avg,
                    max(m.thd_current_l3) AS thd_current_l3_max,
                    avg(m.thd_current_l3) AS thd_current_l3_avg
                FROM ${schema}.measurements m
                JOIN powermeter_info pi ON m.powermeter_id = pi.powermeter_id
                WHERE m."timestamp" >= $3
                  AND m."timestamp" <  $4
                  AND m."timestamp" <= NOW()
                GROUP BY day_start_utc
                ORDER BY day_start_utc ASC
            `;
        } else if (time_interval === 'month') {
            selectQuery = `
                monthly_data AS (
                    SELECT
                        time_bucket(
                            '1 month',
                            m."timestamp",
                            ('1970-01-01 ' || LPAD((0 - pi.offset_hours)::text, 2, '0') || ':00:00+00')::timestamptz
                        ) AS local_month_start_utc,
                        to_char(
                            (
                                time_bucket(
                                    '1 month',
                                    m."timestamp",
                                    ('1970-01-01 ' || LPAD((0 - pi.offset_hours)::text, 2, '0') || ':00:00+00')::timestamptz
                                ) AT TIME ZONE 'UTC' AT TIME ZONE pi.time_zone
                            ),
                            'YYYY-MM'
                        ) AS local_month,
                        max(m.thd_current_l1) AS thd_current_l1_max,
                        avg(m.thd_current_l1) AS thd_current_l1_avg,
                        max(m.thd_current_l2) AS thd_current_l2_max,
                        avg(m.thd_current_l2) AS thd_current_l2_avg,
                        max(m.thd_current_l3) AS thd_current_l3_max,
                        avg(m.thd_current_l3) AS thd_current_l3_avg
                    FROM ${schema}.measurements m
                    JOIN powermeter_info pi ON m.powermeter_id = pi.powermeter_id
                    WHERE m."timestamp" >= $3
                      AND m."timestamp" <  $4
                      AND m."timestamp" <= NOW()
                    GROUP BY local_month_start_utc, local_month
                )
                SELECT
                    local_month AS month_start_local,
                    thd_current_l1_max,
                    thd_current_l1_avg,
                    thd_current_l2_max,
                    thd_current_l2_avg,
                    thd_current_l3_max,
                    thd_current_l3_avg
                FROM monthly_data
                WHERE LEFT(local_month, 4) = TO_CHAR($3::timestamptz, 'YYYY')
                ORDER BY month_start_local ASC
            `;
        } else {
            return { status: 400, body: JSON.stringify({ error: "Invalid time_interval" }) };
        }

        // Compose final SQL
        let sql;
        if (time_interval === 'month') {
            sql = `WITH ${ctes}, ${selectQuery}`;
        } else {
            sql = `WITH ${ctes} ${selectQuery}`;
        }

        // --- Execute SQL ---
        try {
            const result = await executeQuery(sql, [powermeter_id, user_id, start_utc, end_utc]);
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.rows),
            };
        } catch (error) {
            context.log(error);
            return {
                status: 500,
                body: JSON.stringify({ error: "Database error", details: error.message })
            };
        }
    }
});
