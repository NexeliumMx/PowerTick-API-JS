/**
 * File: healthCheck.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/health
 * Brief: Health check endpoint for monitoring database connectivity and API status
 * Date: 2025-07-18
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { getPoolMetrics, executeQuery } = require('./pgPool');
const { createApiResponse, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } = require('./dbUtils');

// Constants following coding instructions
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_STATUS_HEALTHY = 'healthy';
const HEALTH_STATUS_UNHEALTHY = 'unhealthy';
const HEALTH_STATUS_DEGRADED = 'degraded';

/**
 * Performs comprehensive health check of the API and database
 */
async function healthCheckHandler(request, context) {
    const startTime = Date.now();
    const checks = {};
    let overallStatus = HEALTH_STATUS_HEALTHY;

    try {
        // Check 1: Basic API responsiveness
        checks.api = {
            status: HEALTH_STATUS_HEALTHY,
            timestamp: new Date().toISOString(),
            responseTime: 0
        };

        // Check 2: Database connectivity
        try {
            const dbStartTime = Date.now();
            await Promise.race([
                executeQuery('SELECT NOW() as current_time, version() as db_version'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database health check timeout')), HEALTH_CHECK_TIMEOUT_MS)
                )
            ]);
            
            checks.database = {
                status: HEALTH_STATUS_HEALTHY,
                responseTime: Date.now() - dbStartTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            checks.database = {
                status: HEALTH_STATUS_UNHEALTHY,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            overallStatus = HEALTH_STATUS_UNHEALTHY;
        }

        // Check 3: Connection pool metrics
        const poolMetrics = getPoolMetrics();
        checks.connectionPool = {
            status: poolMetrics.status === 'initialized' ? HEALTH_STATUS_HEALTHY : HEALTH_STATUS_UNHEALTHY,
            metrics: poolMetrics,
            timestamp: new Date().toISOString()
        };

        if (poolMetrics.status !== 'initialized') {
            overallStatus = HEALTH_STATUS_UNHEALTHY;
        } else if (poolMetrics.circuitBreakerState !== 'CLOSED') {
            overallStatus = HEALTH_STATUS_DEGRADED;
            checks.connectionPool.status = HEALTH_STATUS_DEGRADED;
        }

        // Check 4: Environment configuration
        const requiredEnvVars = ['PGHOST', 'PGDATABASE', 'PGPORT', 'PGUSER'];
        const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        checks.configuration = {
            status: missingEnvVars.length === 0 ? HEALTH_STATUS_HEALTHY : HEALTH_STATUS_UNHEALTHY,
            environment: process.env.ENVIRONMENT || 'unknown',
            missingVariables: missingEnvVars,
            timestamp: new Date().toISOString()
        };

        if (missingEnvVars.length > 0) {
            overallStatus = HEALTH_STATUS_UNHEALTHY;
        }

        // Calculate overall response time
        const totalResponseTime = Date.now() - startTime;
        checks.api.responseTime = totalResponseTime;

        const responseData = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.ENVIRONMENT || 'unknown',
            uptime: process.uptime(),
            checks,
            metrics: {
                totalResponseTime,
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            }
        };

        const httpStatus = overallStatus === HEALTH_STATUS_HEALTHY ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE;

        return createApiResponse(httpStatus, responseData);

    } catch (error) {
        return createApiResponse(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            {
                status: HEALTH_STATUS_UNHEALTHY,
                timestamp: new Date().toISOString(),
                error: error.message,
                checks
            }
        );
    }
}

app.http('healthCheck', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: healthCheckHandler
});
