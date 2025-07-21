/**
 * FileName: src/functions/dbUtils.js
 * Author(s): Arturo Vargas
 * Brief: Database utility functions for common operations and error handling
 * Date: 2025-07-18
 *
 * Description:
 * Provides standardized database operations, error handling, and response formatting
 * for Azure Functions endpoints. Implements industry best practices for API reliability.
 *
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

const { getClient, executeQuery } = require('./dbClient');

// Constants following coding instructions
const ALLOWED_ENVIRONMENTS = ['production', 'demo', 'dev'];
const DEFAULT_ENVIRONMENT = 'production';
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

/**
 * Logs API operations with environment tag for observability
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function logApiOperation(level, message, metadata = {}) {
    const env = process.env.ENVIRONMENT || 'unknown';
    const logData = {
        timestamp: new Date().toISOString(),
        level,
        message,
        env,
        service: 'powertick-api',
        ...metadata
    };
    
    console[level](JSON.stringify(logData));
}

/**
 * Validates environment parameter against allowed values
 * @param {string} environment - Environment to validate
 * @returns {string} Valid environment or default
 */
function validateEnvironment(environment) {
    if (!environment || !ALLOWED_ENVIRONMENTS.includes(environment)) {
        return DEFAULT_ENVIRONMENT;
    }
    return environment;
}

/**
 * Maps environment to database schema
 * @param {string} environment - Environment name
 * @returns {string} Database schema name
 */
function getSchemaForEnvironment(environment) {
    const validEnv = validateEnvironment(environment);
    return validEnv === 'production' ? 'public' : validEnv;
}

/**
 * Validates required parameters for API endpoints
 * @param {Object} params - Parameters to validate
 * @param {Array<string>} requiredFields - List of required field names
 * @returns {Object} Validation result with isValid and missingFields
 */
function validateRequiredParameters(params, requiredFields) {
    const missingFields = requiredFields.filter(field => !params[field]);
    
    return {
        isValid: missingFields.length === 0,
        missingFields
    };
}

/**
 * Validates UTC timestamp format and range
 * @param {string} timestamp - Timestamp to validate
 * @returns {Object} Validation result
 */
function validateTimestamp(timestamp) {
    if (!timestamp) {
        return { isValid: false, error: 'Timestamp is required' };
    }
    
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Invalid timestamp format' };
    }
    
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneDayFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    if (date < oneYearAgo) {
        return { isValid: false, error: 'Timestamp too far in the past (max 1 year)' };
    }
    
    if (date > oneDayFromNow) {
        return { isValid: false, error: 'Timestamp cannot be in the future' };
    }
    
    return { isValid: true };
}

/**
 * Validates time range for queries
 * @param {string} startUtc - Start timestamp
 * @param {string} endUtc - End timestamp
 * @returns {Object} Validation result
 */
function validateTimeRange(startUtc, endUtc) {
    const startValidation = validateTimestamp(startUtc);
    if (!startValidation.isValid) {
        return { isValid: false, error: `Start time: ${startValidation.error}` };
    }
    
    const endValidation = validateTimestamp(endUtc);
    if (!endValidation.isValid) {
        return { isValid: false, error: `End time: ${endValidation.error}` };
    }
    
    const start = new Date(startUtc);
    const end = new Date(endUtc);
    
    if (start >= end) {
        return { isValid: false, error: 'Start time must be before end time' };
    }
    
    const maxRangeDays = 31; // Maximum 31 days
    const rangeDays = (end - start) / (1000 * 60 * 60 * 24);
    
    if (rangeDays > maxRangeDays) {
        return { 
            isValid: false, 
            error: `Time range too large (max ${maxRangeDays} days, requested ${Math.ceil(rangeDays)} days)` 
        };
    }
    
    return { isValid: true };
}

/**
 * Checks if user has access to a specific powermeter
 * @param {string} userId - User ID
 * @param {string} powermeterId - Powermeter ID
 * @param {string} schema - Database schema
 * @returns {Promise<boolean>} True if user has access
 */
async function validateUserPowermeterAccess(userId, powermeterId, schema) {
    const query = `
        SELECT 1
        FROM ${schema}.powermeters p
        JOIN public.user_installations ui ON p.installation_id = ui.installation_id
        WHERE ui.user_id = $1 AND p.powermeter_id = $2
        LIMIT 1
    `;
    
    try {
        const result = await executeQuery(query, [userId, powermeterId]);
        return result.rowCount > 0;
    } catch (error) {
        logApiOperation('error', 'Failed to validate user powermeter access', {
            userId,
            powermeterId,
            schema,
            error: error.message
        });
        throw error;
    }
}

/**
 * Creates standardized API response
 * @param {number} status - HTTP status code
 * @param {Object} data - Response data
 * @param {string} message - Optional message
 * @param {Object} metadata - Optional metadata
 * @returns {Object} Formatted API response
 */
function createApiResponse(status, data = null, message = null, metadata = {}) {
    const response = {
        status,
        headers: { 
            'Content-Type': 'application/json',
            'X-API-Version': '1.0',
            'X-Environment': process.env.ENVIRONMENT || 'unknown'
        },
        body: JSON.stringify({
            success: status < HTTP_STATUS_BAD_REQUEST,
            timestamp: new Date().toISOString(),
            ...(data && { data }),
            ...(message && { message }),
            ...metadata
        })
    };
    
    return response;
}

/**
 * Creates error response with proper error categorization
 * @param {Error} error - Error object
 * @param {Object} context - Request context
 * @returns {Object} Error response
 */
function createErrorResponse(error, context = {}) {
    logApiOperation('error', 'API error occurred', {
        error: error.message,
        stack: error.stack,
        ...context
    });
    
    // Categorize errors
    if (error.message.includes('Circuit breaker')) {
        return createApiResponse(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            null,
            'Service temporarily unavailable. Please try again later.',
            { errorCode: 'SERVICE_UNAVAILABLE' }
        );
    }
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return createApiResponse(
            HTTP_STATUS_SERVICE_UNAVAILABLE,
            null,
            'Request timeout. Please try again.',
            { errorCode: 'TIMEOUT' }
        );
    }
    
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        return createApiResponse(
            HTTP_STATUS_UNAUTHORIZED,
            null,
            'Authentication failed',
            { errorCode: 'AUTH_FAILED' }
        );
    }
    
    if (error.message.includes('permission') || error.message.includes('access denied')) {
        return createApiResponse(
            HTTP_STATUS_FORBIDDEN,
            null,
            'Access denied',
            { errorCode: 'ACCESS_DENIED' }
        );
    }
    
    // Generic database error
    if (error.code) {
        return createApiResponse(
            HTTP_STATUS_INTERNAL_ERROR,
            null,
            'Database operation failed',
            { errorCode: 'DATABASE_ERROR' }
        );
    }
    
    // Generic internal error
    return createApiResponse(
        HTTP_STATUS_INTERNAL_ERROR,
        null,
        'An unexpected error occurred',
        { errorCode: 'INTERNAL_ERROR' }
    );
}

/**
 * Executes database query with standardized error handling and logging
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Object} operationContext - Context for logging
 * @returns {Promise<Object>} Query result
 */
async function executeQueryWithLogging(query, params = [], operationContext = {}) {
    const startTime = Date.now();
    
    logApiOperation('info', 'Executing database query', {
        operation: operationContext.operation || 'unknown',
        paramCount: params.length,
        ...operationContext
    });
    
    try {
        const result = await executeQuery(query, params);
        const duration = Date.now() - startTime;
        
        logApiOperation('info', 'Database query completed successfully', {
            operation: operationContext.operation || 'unknown',
            duration,
            rowCount: result.rowCount,
            ...operationContext
        });
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logApiOperation('error', 'Database query failed', {
            operation: operationContext.operation || 'unknown',
            duration,
            error: error.message,
            query: query.substring(0, 200) + '...', // First 200 chars
            ...operationContext
        });
        
        throw error;
    }
}

/**
 * Formats measurement data for API response
 * @param {Array} rows - Database rows
 * @param {Object} options - Formatting options
 * @returns {Array} Formatted data
 */
function formatMeasurementData(rows, options = {}) {
    return rows.map(row => {
        const formatted = {};
        
        // Convert timestamps to ISO string if needed
        Object.keys(row).forEach(key => {
            if (row[key] instanceof Date) {
                formatted[key] = row[key].toISOString();
            } else if (typeof row[key] === 'number' && options.roundDecimals) {
                formatted[key] = Math.round(row[key] * 100) / 100; // Round to 2 decimal places
            } else {
                formatted[key] = row[key];
            }
        });
        
        return formatted;
    });
}

/**
 * Middleware wrapper for Azure Function handlers with standardized error handling
 * @param {Function} handler - Original handler function
 * @returns {Function} Wrapped handler
 */
function withErrorHandling(handler) {
    return async (request, context) => {
        const startTime = Date.now();
        const requestId = context.executionContext.invocationId;
        
        logApiOperation('info', 'API request started', {
            method: request.method,
            url: request.url,
            requestId,
            userAgent: request.headers.get('user-agent')
        });
        
        try {
            const result = await handler(request, context);
            const duration = Date.now() - startTime;
            
            logApiOperation('info', 'API request completed', {
                method: request.method,
                url: request.url,
                requestId,
                duration,
                status: result.status
            });
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            const errorResponse = createErrorResponse(error, {
                method: request.method,
                url: request.url,
                requestId,
                duration
            });
            
            return errorResponse;
        }
    };
}

module.exports = {
    // Validation functions
    validateEnvironment,
    getSchemaForEnvironment,
    validateRequiredParameters,
    validateTimestamp,
    validateTimeRange,
    validateUserPowermeterAccess,
    
    // Response functions
    createApiResponse,
    createErrorResponse,
    formatMeasurementData,
    
    // Database functions
    executeQueryWithLogging,
    
    // Middleware
    withErrorHandling,
    
    // Constants
    HTTP_STATUS_OK,
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_INTERNAL_ERROR,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    
    // Logging
    logApiOperation
};
