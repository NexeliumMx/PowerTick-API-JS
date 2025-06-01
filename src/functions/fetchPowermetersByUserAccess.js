/**
 * FileName: src/functions/fetchPowermetersByUserAccess.js
 * Author(s): Arturo Vargas Cuevas
 * Brief: HTTP GET endpoint to fetch powermeters accessible by a specific user.
 * Date: 2025-06-01
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
*/

const { app } = require('@azure/functions');
const { getClient } = require('./dbClient');

const ALLOWED_ENVIROMENTS = ['public', 'demo', 'dev'];

app.http('fetchPowermetersByUserAccess', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const userId = request.query.get('user_id');
        let enviroment = request.query.get('enviroment') || 'public';
        context.log(`Received user_id: ${userId}`);
        context.log(`Received enviroment: ${enviroment}`);

        // Validate enviroment parameter to avoid injection
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

        try {
            const client = await getClient();

            // Dynamically build schema-qualified table name for powermeters only
            const powermetersTable = `${enviroment}.powermeters`;
            const userInstallationsTable = `public.user_installations`;

            // Query to fetch powermeters by user access
            const query = `
                SELECT 
                    p.serial_number, 
                    p.powermeter_alias,
                    p.client_id, 
                    c.client_alias, 
                    p.installation_id, 
                    i.installation_alias
                FROM 
                    ${powermetersTable} p
                JOIN 
                    ${userInstallationsTable} ui ON p.installation_id = ui.installation_id
                JOIN 
                    public.installations i ON p.installation_id = i.installation_id
                JOIN 
                    public.clients c ON p.client_id = c.client_id
                WHERE 
                    ui.user_id = $1;
            `;
            const values = [userId];
            context.log(`Executing query: ${query} with values: ${values}`);
            const res = await client.query(query, values);
            client.release();

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