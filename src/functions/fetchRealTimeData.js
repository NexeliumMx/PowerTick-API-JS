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
const { executeQuery, preWarmPool } = require('./pgPool');
const { withErrorHandling, validateInput, logWithEnv } = require('./errorHandler');

const ALLOWED_ENVIROMENTS = ['public', 'demo', 'dev'];

/**
 * Fetch real-time data with enhanced error handling and validation
 */
async function fetchRealTimeDataHandler(request, context) {
    context.log(`Http function processed request for url "${request.url}"`);

    // Extract and validate parameters
    const params = {
        user_id: request.query.get('user_id'),
        powermeter_id: request.query.get('powermeter_id'),
        enviroment: request.query.get('enviroment') || 'public'
    };
    context.log(`Received parameters: ${JSON.stringify(params)}`);
    // Input validation
    const validation = validateInput(params, {
        user_id: { required: true, type: 'string' },
        powermeter_id: { required: true, type: 'string' },
        enviroment: { required: false, allowedValues: ALLOWED_ENVIROMENTS }
    });
    context.log(`Validation result: ${JSON.stringify(validation)}`);
    if (!validation.isValid) {
        return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: {
                    type: 'ValidationError',
                    message: 'Invalid request parameters',
                    details: validation.errors
                }
            })
        };
    }
    context.log(`Validated parameters: ${JSON.stringify(params)}`);
    const { user_id, powermeter_id, enviroment } = params;
    
    context.log(`Using environment: ${enviroment}`);

    try {
        // First, verify user has access to this powermeter
        const accessQuery = `
            SELECT pm.powermeter_id 
            FROM ${enviroment}.powermeters pm
            JOIN public.user_installations upa ON pm.installation_id = upa.installation_id
            WHERE upa.user_id = $1 AND pm.powermeter_id = $2
        `;
        context.log(`Executing access query: ${accessQuery} with params: [${user_id}, ${powermeter_id}]`);
        const accessResult = await executeQuery(accessQuery, [user_id, powermeter_id]);
        context.log(`Access query result: ${JSON.stringify(accessResult)}`);
        if (accessResult.rowCount == 0) {
            return {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: {
                        type: 'AccessDenied',
                        message: 'User does not have access to this powermeter'
                    }
                })
            };
        }
        context.log(`User ${user_id} has access to powermeter ${powermeter_id}`);
        // Fetch the latest measurement
        const dataQuery = `
            SELECT 
                timestamp,
                voltage_l1, voltage_l2, voltage_l3,
                current_l1, current_l2, current_l3,
                watts_l1, watts_l2, watts_l3, watts,
                var_l1, var_l2, var_l3, var,
                pf_l1, pf_l2, pf_l3, power_factor,
                kwh_imported_total, varh_imported_total,
                frequency
            FROM ${enviroment}.measurements 
            WHERE powermeter_id = $1 
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        
        const result = await executeQuery(dataQuery, [powermeter_id]);
        context.log(`Data query executed: ${dataQuery} with result: ${JSON.stringify(result)}`);
        if (!(result.rowCount===1)) {
            throw new Error(`Database query failed: ${result.error}`);
        }

        context.log(`Fetched data for powermeter ${powermeter_id}: ${JSON.stringify(result.rows)}`);

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                data: result.rows[0],
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        context.log.error(`Error in fetchRealTimeDataHandler: ${error.message}`, error);
        throw error; // Let the error handler wrapper handle this
    }
}

app.http('fetchRealTimeData', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: withErrorHandling(fetchRealTimeDataHandler, {
        operation: 'fetchRealTimeData',
        maxRetries: 2,
        timeout: 25000
    })
});