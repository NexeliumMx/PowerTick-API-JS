/**
 * File: resetCircuitBreaker.js
 * Author(s): Arturo Vargas
 * Endpoint: POST /api/reset-circuit-breaker
 * Brief: Emergency endpoint to reset circuit breaker for debugging
 * Date: 2025-07-21
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { resetCircuitBreaker, getPoolMetrics, executeQuery } = require('./dbClient');
const { createApiResponse, HTTP_STATUS_OK, HTTP_STATUS_INTERNAL_ERROR } = require('./dbUtils');

/**
 * Resets the circuit breaker and attempts database connection
 */
async function resetCircuitBreakerHandler(request, context) {
    try {
        // Get metrics before reset
        const metricsBefore = getPoolMetrics();
        
        // Reset circuit breaker
        resetCircuitBreaker();
        
        // Try to execute a simple query to test connectivity
        let testResult = null;
        let testError = null;
        
        try {
            testResult = await executeQuery('SELECT NOW() as current_time, \'Circuit breaker reset successful\' as message');
        } catch (error) {
            testError = error.message;
        }
        
        // Get metrics after reset
        const metricsAfter = getPoolMetrics();
        
        const responseData = {
            action: 'circuit-breaker-reset',
            timestamp: new Date().toISOString(),
            metricsBefore,
            metricsAfter,
            testQuery: {
                success: testResult !== null,
                result: testResult?.rows?.[0] || null,
                error: testError
            }
        };

        return createApiResponse(HTTP_STATUS_OK, responseData, 'Circuit breaker reset completed');

    } catch (error) {
        return createApiResponse(
            HTTP_STATUS_INTERNAL_ERROR,
            {
                action: 'circuit-breaker-reset',
                timestamp: new Date().toISOString(),
                error: error.message
            },
            'Failed to reset circuit breaker'
        );
    }
}

app.http('resetCircuitBreaker', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: resetCircuitBreakerHandler
});
