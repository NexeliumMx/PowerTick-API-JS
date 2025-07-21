/**
 * FileName: src/functions/fetchRealTimeData.js
 * Author(s): Arturo Vargas Cuevas
 * Brief: HTTP GET endpoint to fetch the latest measurement for a specific powermeter accessible by a user.
 * Date: 2025-06-01
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
*/

const { app } = require('@azure/functions');
const { executeQuery } = require('./dbClient');

const ALLOWED_ENVIROMENTS = ['public', 'demo', 'dev'];

app.http('fetchRealTimeData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        const powermeterId = request.query.get('powermeter_id');
        let enviroment = request.query.get('enviroment') || 'public';
        context.log(`Received user_id: ${userId}`);
        context.log(`Received powermeter_id: ${powermeterId}`);
        context.log(`Received enviroment: ${enviroment}`);

        // Validate parameters
        if (!ALLOWED_ENVIROMENTS.includes(enviroment)) {
            context.log('Invalid enviroment parameter');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'Invalid enviroment' })
            };
        }
        if (!userId) {
            context.log('user_id is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'user_id is required' })
            };
        }
        if (!powermeterId) {
            context.log('powermeter_id is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'powermeter_id is required' })
            };
        }

        try {
            // Dynamically build schema-qualified table names
            const powermetersTable = `${enviroment}.powermeters`;
            const measurementsTable = `${enviroment}.measurements`;
            const userInstallationsTable = `public.user_installations`;

            // Use a parameterized query for safety
            const query = `
                WITH user_access AS (
                    SELECT 1
                    FROM ${powermetersTable} p
                    JOIN ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
                    WHERE ui.user_id = $1
                      AND p.powermeter_id = $2
                )
                SELECT *
                FROM ${measurementsTable}
                WHERE powermeter_id = $2
                  AND "timestamp" < NOW()
                  AND EXISTS (SELECT 1 FROM user_access)
                ORDER BY "timestamp" DESC
                LIMIT 1;
            `;
            const values = [userId, powermeterId];
            context.log(`Executing query: ${query} with values: ${values}`);
            const res = await executeQuery(query, values);

            context.log("Database query executed successfully:", res.rows);

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