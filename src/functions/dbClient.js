/**
 * FileName: src/functions/dbClient.js
 * Author(s): Guillermo de Alba, Arturo Vargas
 * Brief: Provides a PostgreSQL connection pool for both local and Azure environments.
 * Date: 2025-07-18
 *
 * Description:
 * This module exports a function to obtain a PostgreSQL client from a managed connection pool,
 * supporting both local development and Azure deployments. For local use, it authenticates with
 * username and password. In Azure, it leverages Managed Identity and token-based authentication
 * via DefaultAzureCredential.
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 *
 * Features:
 * - Connection pooling with configurable limits and timeouts
 * - Azure Managed Identity with automatic token refresh
 * - Exponential backoff retry logic for transient failures
 * - Circuit breaker pattern for fault tolerance
 * - Health checks and connection validation
 * - Comprehensive logging and metrics
 * - Graceful shutdown handling
 */

const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

// Constants for configuration (performance optimized)
const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
const IDLE_TIMEOUT_MS = 300000; // 5 minutes
const MAX_CONNECTIONS = 20; // Maximum pool size
const MIN_CONNECTIONS = 2; // Minimum pool size
const STATEMENT_TIMEOUT_MS = 60000; // 1 minute
const QUERY_TIMEOUT_MS = 45000; // 45 seconds
const TOKEN_REFRESH_THRESHOLD_MS = 300000; // 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 8000;

// Circuit breaker configuration (enhanced)
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute
const CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS = 3; // Max calls in half-open state

// Performance monitoring constants
const SLOW_QUERY_THRESHOLD_MS = 1000; // Log queries slower than 1 second
const POOL_STATS_LOG_INTERVAL_MS = 300000; // Log pool stats every 5 minutes

let pool;
let azureCredential;
let currentToken;
let tokenExpiryTime;
let circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
let circuitBreakerFailureCount = 0;
let circuitBreakerLastFailureTime = 0;

/**
 * Logs messages with environment tag for observability
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function logWithEnv(level, message, metadata = {}) {
    const env = process.env.ENVIRONMENT || 'unknown';
    const logData = {
        timestamp: new Date().toISOString(),
        level,
        message,
        env,
        service: 'postgresql-client',
        ...metadata
    };
    
    console[level](JSON.stringify(logData));
}

/**
 * Implements exponential backoff for retry logic
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt) {
    const delay = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
        MAX_RETRY_DELAY_MS
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
}

// Pre-compiled Set for O(1) lookup performance
const RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED', 
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN'
]);

// Pre-compiled RegExp for efficient string matching
const RETRYABLE_MESSAGE_PATTERN = /connection terminated|connection closed|server closed the connection|timeout expired|too many clients/i;

/**
 * Checks if an error is retryable (optimized for performance)
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
function isRetryableError(error) {
    if (!error) return false;
    
    // O(1) code lookup
    if (error.code && RETRYABLE_CODES.has(error.code)) return true;
    
    // Single regex test instead of multiple string operations
    return error.message && RETRYABLE_MESSAGE_PATTERN.test(error.message);
}

/**
 * Circuit breaker implementation
 */
const circuitBreaker = {
    recordSuccess() {
        circuitBreakerFailureCount = 0;
        if (circuitBreakerState === 'HALF_OPEN') {
            circuitBreakerState = 'CLOSED';
            logWithEnv('info', 'Circuit breaker closed after successful operation');
        }
    },
    
    recordFailure() {
        circuitBreakerFailureCount++;
        circuitBreakerLastFailureTime = Date.now();
        
        if (circuitBreakerFailureCount >= CIRCUIT_BREAKER_THRESHOLD) {
            circuitBreakerState = 'OPEN';
            logWithEnv('warn', 'Circuit breaker opened due to consecutive failures', {
                failureCount: circuitBreakerFailureCount
            });
        }
    },
    
    canExecute() {
        if (circuitBreakerState === 'CLOSED') return true;
        
        if (circuitBreakerState === 'OPEN') {
            const timeSinceLastFailure = Date.now() - circuitBreakerLastFailureTime;
            if (timeSinceLastFailure >= CIRCUIT_BREAKER_TIMEOUT_MS) {
                circuitBreakerState = 'HALF_OPEN';
                logWithEnv('info', 'Circuit breaker moved to half-open state');
                return true;
            }
            return false;
        }
        
        return circuitBreakerState === 'HALF_OPEN';
    }
};

/**
 * Retrieves and caches Azure access token with automatic refresh (optimized)
 * @returns {Promise<string>} Valid access token
 */
async function getAzureToken() {
    const now = Date.now();
    
    // Fast path: return cached token if still valid (avoid redundant calculations)
    if (currentToken && tokenExpiryTime && now < (tokenExpiryTime - TOKEN_REFRESH_THRESHOLD_MS)) {
        return currentToken;
    }
    
    // Lazy initialization for better cold start performance
    if (!azureCredential) {
        azureCredential = new DefaultAzureCredential({
            managedIdentityClientId: process.env.AZURE_CLIENT_ID
            // Removed excludeCredentials to ensure compatibility
        });
    }
    
    logWithEnv('info', 'Requesting new Azure access token');
    
    try {
        const tokenResponse = await azureCredential.getToken('https://ossrdbms-aad.database.windows.net');
        
        if (!tokenResponse?.token) {
            throw new Error('Invalid token response from Azure Managed Identity');
        }
        
        currentToken = tokenResponse.token;
        tokenExpiryTime = tokenResponse.expiresOnTimestamp;
        
        logWithEnv('info', 'Azure access token retrieved successfully', {
            expiresAt: new Date(tokenExpiryTime).toISOString(),
            validFor: Math.round((tokenExpiryTime - now) / 60000) + ' minutes'
        });
        
        return currentToken;
    } catch (error) {
        logWithEnv('error', 'Failed to retrieve Azure access token', {
            error: error.message,
            stack: error.stack
        });
        throw new Error(`Azure authentication failed: ${error.message}`);
    }
}

/**
 * Creates pool configuration based on environment (performance optimized)
 * @returns {Promise<Object>} Pool configuration object
 */
async function createPoolConfig() {
    const isLocal = process.env.ENVIRONMENT === 'local';
    
    const baseConfig = {
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        port: parseInt(process.env.PGPORT) || 5432,
        user: process.env.PGUSER,
        
        // Optimized connection pool settings
        max: MAX_CONNECTIONS,
        min: MIN_CONNECTIONS,
        idleTimeoutMillis: IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        
        // Performance optimized query settings
        statement_timeout: STATEMENT_TIMEOUT_MS,
        query_timeout: QUERY_TIMEOUT_MS,
        
        // SSL configuration
        ssl: {
            rejectUnauthorized: false
        },
        
        // Application name for monitoring
        application_name: `powertick-api-${process.env.ENVIRONMENT || 'unknown'}`,
        
        // Keep alive settings
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        
        // Connection validation
        parseInputDatesAsUTC: true
    };
    
    if (isLocal) {
        logWithEnv('info', 'Configuring pool for local development');
        return {
            ...baseConfig,
            password: process.env.PGPASSWORD
        };
    } else {
        logWithEnv('info', 'Configuring pool for Azure with Managed Identity');
        const token = await getAzureToken();
        return {
            ...baseConfig,
            password: token
        };
    }
}

/**
 * Validates pool health and connectivity
 * @returns {Promise<boolean>} True if pool is healthy
 */
async function validatePoolHealth() {
    if (!pool) return false;
    
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        logWithEnv('warn', 'Pool health check failed', {
            error: error.message
        });
        return false;
    }
}

/**
 * Initializes connection pool with retry logic and error handling
 * @returns {Promise<Pool>} Initialized PostgreSQL connection pool
 */
async function initPool() {
    if (pool) {
        logWithEnv('info', 'Reusing existing connection pool');
        return pool;
    }
    
    let lastError;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            logWithEnv('info', 'Initializing PostgreSQL connection pool', {
                attempt: attempt + 1,
                maxAttempts: MAX_RETRY_ATTEMPTS
            });
            
            const config = await createPoolConfig();
            pool = new Pool(config);
            
            // Set up pool event handlers
            pool.on('connect', (client) => {
                logWithEnv('info', 'New client connected to pool', {
                    totalCount: pool.totalCount,
                    idleCount: pool.idleCount,
                    waitingCount: pool.waitingCount
                });
            });
            
            pool.on('remove', (client) => {
                logWithEnv('info', 'Client removed from pool', {
                    totalCount: pool.totalCount,
                    idleCount: pool.idleCount
                });
            });
            
            pool.on('error', (err, client) => {
                logWithEnv('error', 'Pool error occurred', {
                    error: err.message,
                    stack: err.stack,
                    totalCount: pool.totalCount,
                    idleCount: pool.idleCount
                });
                circuitBreaker.recordFailure();
            });
            
            // Test the connection
            const testClient = await pool.connect();
            await testClient.query('SELECT NOW() as current_time, version() as pg_version');
            testClient.release();
            
            logWithEnv('info', 'PostgreSQL connection pool initialized successfully', {
                maxConnections: MAX_CONNECTIONS,
                minConnections: MIN_CONNECTIONS,
                environment: process.env.ENVIRONMENT || 'unknown'
            });
            
            circuitBreaker.recordSuccess();
            return pool;
            
        } catch (error) {
            lastError = error;
            circuitBreaker.recordFailure();
            
            logWithEnv('error', 'Failed to initialize connection pool', {
                attempt: attempt + 1,
                error: error.message,
                stack: error.stack
            });
            
            if (attempt < MAX_RETRY_ATTEMPTS - 1 && isRetryableError(error)) {
                const delay = calculateRetryDelay(attempt);
                logWithEnv('info', `Retrying pool initialization in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    logWithEnv('error', 'Failed to initialize connection pool after all attempts', {
        attempts: MAX_RETRY_ATTEMPTS,
        lastError: lastError.message
    });
    
    throw new Error(`Connection pool initialization failed: ${lastError.message}`);
}

/**
 * Safely destroys the connection pool
 */
async function destroyPool() {
    if (pool) {
        try {
            logWithEnv('info', 'Destroying connection pool');
            await pool.end();
            pool = null;
            logWithEnv('info', 'Connection pool destroyed successfully');
        } catch (error) {
            logWithEnv('error', 'Error destroying connection pool', {
                error: error.message
            });
        }
    }
}

/**
 * Gets a client from the connection pool with comprehensive error handling
 * @returns {Promise<import('pg').PoolClient>} Database client
 */
async function getClient() {
    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
        const error = new Error('Circuit breaker is open - database operations temporarily disabled');
        logWithEnv('warn', 'Request blocked by circuit breaker');
        throw error;
    }

    try {
        // Initialize pool only if it doesn't exist (avoid redundant initialization)
        if (!pool) {
            pool = await initPool();
        }
        
        const activePool = pool;        logWithEnv('info', 'Acquiring client from pool', {
            totalCount: activePool.totalCount,
            idleCount: activePool.idleCount,
            waitingCount: activePool.waitingCount
        });
        
        // Get client with timeout
        const client = await Promise.race([
            activePool.connect(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Client acquisition timeout')), CONNECTION_TIMEOUT_MS)
            )
        ]);
        
        // Enhance client with custom methods
        const originalRelease = client.release.bind(client);
        client.release = (err) => {
            if (err) {
                logWithEnv('error', 'Client released with error', {
                    error: err.message
                });
                circuitBreaker.recordFailure();
            } else {
                logWithEnv('info', 'Client released successfully');
                circuitBreaker.recordSuccess();
            }
            originalRelease(err);
        };
        
        // Add query timeout wrapper
        const originalQuery = client.query.bind(client);
        client.query = async (...args) => {
            const startTime = Date.now();
            try {
                const result = await Promise.race([
                    originalQuery(...args),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
                    )
                ]);
                
                const duration = Date.now() - startTime;
                logWithEnv('info', 'Query executed successfully', {
                    duration,
                    rowCount: result.rowCount
                });
                
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                logWithEnv('error', 'Query failed', {
                    duration,
                    error: error.message,
                    query: args[0]?.substring(0, 100) + '...' // Log first 100 chars of query
                });
                throw error;
            }
        };
        
        return client;
        
    } catch (error) {
        circuitBreaker.recordFailure();
        logWithEnv('error', 'Failed to acquire database client', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Executes a query with automatic retry logic and connection management
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function executeQuery(query, params = []) {
    let client;
    let lastError;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            client = await getClient();
            const result = await client.query(query, params);
            client.release();
            return result;
            
        } catch (error) {
            lastError = error;
            
            if (client) {
                client.release(error);
                client = null;
            }
            
            if (attempt < MAX_RETRY_ATTEMPTS - 1 && isRetryableError(error)) {
                const delay = calculateRetryDelay(attempt);
                logWithEnv('warn', `Query failed, retrying in ${delay}ms`, {
                    attempt: attempt + 1,
                    error: error.message
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                break;
            }
        }
    }
    
    throw lastError;
}

/**
 * Gets connection pool metrics for monitoring
 * @returns {Object} Pool metrics
 */
function getPoolMetrics() {
    if (!pool) {
        return {
            status: 'not_initialized',
            totalCount: 0,
            idleCount: 0,
            waitingCount: 0,
            circuitBreakerState,
            circuitBreakerFailureCount
        };
    }
    
    return {
        status: 'initialized',
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        circuitBreakerState,
        circuitBreakerFailureCount
    };
}

/**
 * Manually resets the circuit breaker (for emergency recovery)
 * @returns {void}
 */
function resetCircuitBreaker() {
    circuitBreakerState = 'CLOSED';
    circuitBreakerFailureCount = 0;
    circuitBreakerLastFailureTime = 0;
    
    logWithEnv('warn', 'Circuit breaker manually reset', {
        timestamp: new Date().toISOString(),
        action: 'manual_reset'
    });
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    logWithEnv('info', 'Received SIGTERM, shutting down gracefully');
    await destroyPool();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logWithEnv('info', 'Received SIGINT, shutting down gracefully');
    await destroyPool();
    process.exit(0);
});

module.exports = { 
    getClient, 
    executeQuery, 
    getPoolMetrics, 
    destroyPool,
    resetCircuitBreaker
};