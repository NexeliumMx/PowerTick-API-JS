/**
 * File: ping.js
 * Author(s): Arturo Vargas
 * Endpoint: GET /api/ping
 * Brief: Ultra-lightweight ping endpoint for basic Azure Functions health monitoring
 * Date: 2025-07-21
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { preWarmPool } = require('./pgPool');

// Constants following coding instructions
const HTTP_STATUS_OK = 200;

/**
 * Ultra-fast ping endpoint that responds immediately
 * Triggers background pool pre-warming for Azure Functions cold starts
 */
async function pingHandler(request, context) {
    const startTime = Date.now();
    const isColdStart = process.uptime() < 30;
    
    // Trigger background pre-warming on cold starts without waiting
    if (isColdStart) {
        preWarmPool();
    }
    
    const responseTime = Date.now() - startTime;
    
    return {
        status: HTTP_STATUS_OK,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            message: 'pong',
            responseTime,
            uptime: process.uptime(),
            coldStart: isColdStart,
            nodeVersion: process.version,
            environment: process.env.ENVIRONMENT || 'cloud'
        })
    };
}

app.http('ping', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: pingHandler
});
