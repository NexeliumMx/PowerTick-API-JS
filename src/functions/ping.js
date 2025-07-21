/**
 * File: ping.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/ping
 * Brief: Enhanced ping endpoint for Azure Functions warmup and health monitoring
 * Date: 2025-07-21
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { preWarmPool } = require('./pgPool');
const { logWithEnv, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } = require('./errorHandler');

// Constants following coding instructions
const COLD_START_THRESHOLD_SECONDS = 30;

/**
 * Enhanced ping endpoint for warmup and health monitoring
 * Optimized for Azure Functions Consumption plan
 */
async function pingHandler(request, context) {
    const startTime = Date.now();
    const isColdStart = process.uptime() < COLD_START_THRESHOLD_SECONDS;
    
    // Log ping request for monitoring
    logWithEnv('info', 'Ping request received', {
        coldStart: isColdStart,
        uptime: process.uptime(),
        queryParams: Object.fromEntries(request.query.entries())
    }, context);
    
    try {
        // Check if we should perform warmup
        const shouldPerformWarmup = isColdStart || request.query.get('warmup') === 'true';
        let warmupStatus = 'not-triggered';
        
        if (shouldPerformWarmup) {
            warmupStatus = 'triggered';
            // Trigger background pre-warming without waiting
            preWarmPool().catch(error => {
                logWithEnv('warn', 'Background pre-warm failed', {
                    error: error.message,
                    errorType: error.name
                }, context);
            });
        }
        
        const responseTime = Date.now() - startTime;
        const memoryUsage = process.memoryUsage();
        
        // Enhanced response with system information
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            message: 'pong',
            responseTime,
            system: {
                uptime: process.uptime(),
                coldStart: isColdStart,
                warmupTriggered: warmupStatus,
                nodeVersion: process.version,
                environment: process.env.ENVIRONMENT || 'cloud',
                plan: 'consumption',
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                    external: Math.round(memoryUsage.external / 1024 / 1024) // MB
                }
            }
        };
        
        // Add detailed health check if requested
        if (request.query.get('detailed') === 'true') {
            try {
                // You can add database health check here if needed
                response.health = {
                    database: 'not-checked', // Set to 'healthy' or 'unhealthy' after DB check
                    connectionPool: 'available'
                };
            } catch (healthError) {
                logWithEnv('warn', 'Health check failed', {
                    error: healthError.message
                }, context);
                response.health = {
                    database: 'error',
                    error: healthError.message
                };
            }
        }
        
        return {
            status: HTTP_STATUS_OK,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Response-Time': responseTime.toString()
            },
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        logWithEnv('error', 'Ping endpoint error', {
            error: error.message,
            errorStack: error.stack
        }, context);
        
        return {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                success: false,
                timestamp: new Date().toISOString(),
                message: 'Ping failed',
                responseTime: Date.now() - startTime,
                error: error.message
            })
        };
    }
}

app.http('ping', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: pingHandler
});
