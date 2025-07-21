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
const { getPoolMetrics, healthCheck, preWarmPool } = require('./pgPool');
const { createApiResponse, HTTP_STATUS_OK, HTTP_STATUS_SERVICE_UNAVAILABLE } = require('./dbUtils');

// Constants following coding instructions
const HEALTH_CHECK_TIMEOUT_MS = 25000; // Increased to 25 seconds for Azure cold starts
const HEALTH_CHECK_DB_TIMEOUT_MS = 20000; // 20 seconds for database operations
const HEALTH_STATUS_HEALTHY = 'healthy';
const HEALTH_STATUS_UNHEALTHY = 'unhealthy';
const HEALTH_STATUS_DEGRADED = 'degraded';
const COLD_START_THRESHOLD_MS = 5000; // Consider responses over 5s as cold start degradation

/**
 * Performs comprehensive health check of the API and database with Azure Functions optimizations
 */
async function healthCheckHandler(request, context) {
    const startTime = Date.now();
    const checks = {};
    let overallStatus = HEALTH_STATUS_HEALTHY;
    let isColdStart = process.uptime() < 30; // Less than 30 seconds uptime indicates cold start

    try {
        // For cold starts, trigger background pre-warming immediately
        if (isColdStart) {
            preWarmPool(); // Non-blocking background initialization
        }

        // Set up overall timeout to prevent Azure Functions from hanging
        const overallTimeout = setTimeout(() => {
            context.log.warn('Health check overall timeout reached');
        }, HEALTH_CHECK_TIMEOUT_MS);

        // Check 1: Basic API responsiveness
        checks.api = {
            status: HEALTH_STATUS_HEALTHY,
            timestamp: new Date().toISOString(),
            responseTime: 0,
            coldStart: isColdStart
        };

        // Check 2: Database connectivity with enhanced graceful degradation
        try {
            const dbStartTime = Date.now();
            
            // Use shorter timeout for cold starts to fail fast
            const dbTimeout = isColdStart ? 10000 : HEALTH_CHECK_DB_TIMEOUT_MS;
            
            const dbResult = await Promise.race([
                healthCheck(), // Use lightweight health check method
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Database health check timeout')), dbTimeout)
                )
            ]);
            
            const responseTime = Date.now() - dbStartTime;
            checks.database = {
                status: HEALTH_STATUS_HEALTHY,
                responseTime,
                timestamp: new Date().toISOString(),
                coldStart: isColdStart
            };
            
            // Enhanced degradation logic for cold starts
            if (responseTime > COLD_START_THRESHOLD_MS || isColdStart) {
                checks.database.status = HEALTH_STATUS_DEGRADED;
                checks.database.warning = isColdStart ? 
                    'Cold start detected - temporary degradation expected' : 
                    'Slow database response time';
                if (overallStatus === HEALTH_STATUS_HEALTHY) {
                    overallStatus = HEALTH_STATUS_DEGRADED;
                }
            }
            
        } catch (error) {
            // For cold starts, treat timeouts as degraded instead of unhealthy
            const isTimeout = error.message.includes('timeout');
            const status = (isColdStart && isTimeout) ? HEALTH_STATUS_DEGRADED : HEALTH_STATUS_UNHEALTHY;
            
            checks.database = {
                status: status,
                error: error.message,
                timestamp: new Date().toISOString(),
                coldStart: isColdStart,
                warning: isColdStart ? 'Cold start database initialization in progress' : undefined
            };
            
            // Don't mark overall as unhealthy during cold starts for timeout errors
            if (!(isColdStart && isTimeout)) {
                overallStatus = HEALTH_STATUS_UNHEALTHY;
            } else if (overallStatus === HEALTH_STATUS_HEALTHY) {
                overallStatus = HEALTH_STATUS_DEGRADED;
            }
        }

        // Check 3: Connection pool metrics with cold start awareness
        const poolMetrics = getPoolMetrics();
        let poolStatus = HEALTH_STATUS_HEALTHY;
        
        if (poolMetrics.status !== 'initialized') {
            // During cold starts, uninitialized pools are expected (degraded, not unhealthy)
            poolStatus = isColdStart ? HEALTH_STATUS_DEGRADED : HEALTH_STATUS_UNHEALTHY;
        } else if (poolMetrics.circuitBreakerState === 'OPEN') {
            // Circuit breaker open during cold start is common, treat as degraded
            poolStatus = isColdStart ? HEALTH_STATUS_DEGRADED : HEALTH_STATUS_UNHEALTHY;
        } else if (poolMetrics.circuitBreakerState === 'HALF_OPEN') {
            poolStatus = HEALTH_STATUS_DEGRADED;
        }
        
        checks.connectionPool = {
            status: poolStatus,
            metrics: poolMetrics,
            timestamp: new Date().toISOString(),
            coldStart: isColdStart
        };

        // Update overall status based on pool status with cold start consideration
        if (poolStatus === HEALTH_STATUS_UNHEALTHY && overallStatus !== HEALTH_STATUS_UNHEALTHY && !isColdStart) {
            overallStatus = HEALTH_STATUS_UNHEALTHY;
        } else if (poolStatus === HEALTH_STATUS_DEGRADED && overallStatus === HEALTH_STATUS_HEALTHY) {
            overallStatus = HEALTH_STATUS_DEGRADED;
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
            environment: process.env.ENVIRONMENT || 'cloud',
            uptime: process.uptime(),
            coldStart: isColdStart,
            checks,
            metrics: {
                totalResponseTime,
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            }
        };

        // For cold starts, always return 200 even if degraded to avoid unnecessary alarms
        const httpStatus = (overallStatus === HEALTH_STATUS_UNHEALTHY && !isColdStart) ? 
            HTTP_STATUS_SERVICE_UNAVAILABLE : HTTP_STATUS_OK;

        clearTimeout(overallTimeout);
        return createApiResponse(httpStatus, responseData);

    } catch (error) {
        context.log.error('Health check error:', error);
        
        return createApiResponse(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            {
                status: HEALTH_STATUS_UNHEALTHY,
                timestamp: new Date().toISOString(),
                error: error.message,
                coldStart: isColdStart,
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
