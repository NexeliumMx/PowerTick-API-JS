/**
 * File: testDBconnection.js
 * Author(s): Arturo Vargas  
 * Endpoint: GET /api/testDBconnection
 * Brief: Enhanced database connection test with detailed diagnostics
 * Date: 2025-07-18
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { app } = require('@azure/functions');
const { Client } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { createApiResponse, HTTP_STATUS_OK, HTTP_STATUS_INTERNAL_ERROR } = require('./dbUtils');

/**
 * Tests database connection with simplified approach and detailed diagnostics
 */
async function testDBConnectionHandler(request, context) {
    const startTime = Date.now();
    let client;
    
    try {
        // Try to get Azure token first
        let token = null;
        let tokenError = null;
        
        if (process.env.ENVIRONMENT !== 'local') {
            try {
                const tokenStart = Date.now();
                const credential = new DefaultAzureCredential();
                const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net');
                token = tokenResponse.token;
                const tokenTime = Date.now() - tokenStart;
                
                context.log(`Token acquired in ${tokenTime}ms`);
            } catch (error) {
                tokenError = error.message;
                context.log(`Token error: ${error.message}`);
            }
        }
        
        // Create simple client configuration
        const config = {
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            port: parseInt(process.env.PGPORT) || 5432,
            user: process.env.PGUSER,
            password: process.env.ENVIRONMENT === 'local' ? process.env.PGPASSWORD : token,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, // 10 seconds
            statement_timeout: 10000,
            query_timeout: 10000
        };
        
        context.log('Attempting database connection...');
        
        // Test connection
        client = new Client(config);
        
        const connectStart = Date.now();
        await client.connect();
        const connectTime = Date.now() - connectStart;
        
        context.log(`Connected in ${connectTime}ms`);
        
        const queryStart = Date.now();
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        const queryTime = Date.now() - queryStart;
        
        const totalTime = Date.now() - startTime;
        
        const responseData = {
            success: true,
            timestamp: new Date().toISOString(),
            environment: process.env.ENVIRONMENT || 'unknown',
            timing: {
                totalTime,
                connectTime,
                queryTime
            },
            auth: {
                method: process.env.ENVIRONMENT === 'local' ? 'password' : 'azure-token',
                tokenObtained: token !== null,
                tokenError
            },
            database: {
                result: result.rows[0]
            },
            config: {
                host: process.env.PGHOST,
                database: process.env.PGDATABASE,
                port: process.env.PGPORT,
                user: process.env.PGUSER
            }
        };

        return createApiResponse(HTTP_STATUS_OK, responseData, 'Database connection test successful');

    } catch (error) {
        const totalTime = Date.now() - startTime;
        context.log(`Connection failed after ${totalTime}ms: ${error.message}`);
        
        return createApiResponse(
            HTTP_STATUS_INTERNAL_ERROR,
            {
                success: false,
                timestamp: new Date().toISOString(),
                error: error.message,
                errorCode: error.code,
                timing: { totalTime },
                environment: process.env.ENVIRONMENT || 'unknown'
            },
            'Database connection test failed'
        );
    } finally {
        if (client) {
            try {
                await client.end();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }
}

app.http('testDBconnection', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: testDBConnectionHandler
});