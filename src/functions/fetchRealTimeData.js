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
    logWithEnv('info', 'Fetch real-time data request started', {
        url: request.url,
        uptime: process.uptime()
    }, context);

    // Trigger background pool pre-warming on cold starts
    if (process.uptime() < 30) {
        preWarmPool().catch(error => {
            logWithEnv('warn', 'Background pre-warm failed', {
                error: error.message
            }, context);
        });
    }

    // Extract and validate parameters
    const params = {
        user_id: request.query.get('user_id'),
        powermeter_id: request.query.get('powermeter_id'),
        enviroment: request.query.get('enviroment') || 'public'
    };

    // Input validation
    const validation = validateInput(params, {
        user_id: { required: true, type: 'string' },
        powermeter_id: { required: true, type: 'string' },
        enviroment: { required: false, allowedValues: ALLOWED_ENVIROMENTS }
    });

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

    const { user_id, powermeter_id, enviroment } = params;
    
    logWithEnv('info', 'Processing real-time data request', {
        user_id,
        powermeter_id,
        enviroment
    }, context);

    try {
        // First, verify user has access to this powermeter
        const accessQuery = `
            SELECT pm.powermeter_id 
            FROM ${enviroment}.powermeters pm
            JOIN public.user_installations upa ON pm.installation_id = upa.installation_id
            WHERE upa.user_id = $1 AND pm.powermeter_id = $2
        `;
        
        const accessResult = await executeQuery(accessQuery, [user_id, powermeter_id]);
        
        if (accessResult.data.length === 0) {
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

        // Fetch the latest measurement
        const dataQuery = `
            SELECT 
                timestamp,
                voltage_l1_n, voltage_l2_n, voltage_l3_n,
                current_l1, current_l2, current_l3,
                watts_l1, watts_l2, watts_l3, watts_total,
                vars_l1, vars_l2, vars_l3, vars_total,
                pf_l1, pf_l2, pf_l3, pf_total,
                kwh_total, kvarh_total,
                frequency
            FROM ${enviroment}.measurements 
            WHERE powermeter_id = $1 
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        
        const result = await executeQuery(dataQuery, [powermeter_id]);
        
        if (!result.success) {
            throw new Error(`Database query failed: ${result.error}`);
        }

        logWithEnv('info', 'Real-time data retrieved successfully', {
            user_id,
            powermeter_id,
            recordCount: result.data.length
        }, context);

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                data: result.data,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        logWithEnv('error', 'Failed to fetch real-time data', {
            user_id,
            powermeter_id,
            enviroment,
            error: error.message
        }, context);
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