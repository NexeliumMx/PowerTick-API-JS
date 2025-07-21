/**
 * File: errorHandler.js
 * Author(s): Arturo Vargas
 * Brief: Centralized error handling following Azure Functions best practices
 * Date: 2025-07-21
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

// Constants for error handling
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_RATE_LIMITED = 429;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;

// Maximum retry attempts for different error types
const MAX_RETRIES_TRANSIENT = 3;
const MAX_RETRIES_RATE_LIMIT = 5;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Logs errors with environment tag for observability
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @param {Object} context - Function context
 */
function logWithEnv(level, message, metadata = {}, context) {
    const env = process.env.ENVIRONMENT || 'cloud';
    const logEntry = {
        level,
        message,
        env,
        timestamp: new Date().toISOString(),
        correlationId: context?.invocationId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...metadata
    };
    
    if (context && context.log) {
        context.log[level]?.(JSON.stringify(logEntry));
    } else {
        console[level === 'error' ? 'error' : 'log'](JSON.stringify(logEntry));
    }
}

/**
 * Determines if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
function isRetryableError(error) {
    // Network and connection errors
    const retryableCodes = new Set([
        'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
        'EPIPE', 'ECONNABORTED', 'ENETUNREACH', 'EHOSTUNREACH'
    ]);
    
    if (error.code && retryableCodes.has(error.code)) {
        return true;
    }
    
    // HTTP status codes that are retryable
    const retryableStatuses = new Set([
        HTTP_STATUS_RATE_LIMITED,
        HTTP_STATUS_INTERNAL_ERROR,
        HTTP_STATUS_BAD_GATEWAY,
        HTTP_STATUS_SERVICE_UNAVAILABLE,
        HTTP_STATUS_GATEWAY_TIMEOUT
    ]);
    
    if (error.status && retryableStatuses.has(error.status)) {
        return true;
    }
    
    // Database-specific errors
    const retryableMessages = [
        'connection terminated', 'connection closed', 'server closed the connection',
        'timeout expired', 'too many clients', 'database is starting up',
        'temporary failure', 'deadlock detected'
    ];
    
    const errorMessage = (error.message || '').toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Creates standardized error responses
 * @param {Error} error - The error object
 * @param {Object} context - Function context
 * @param {string} operation - Operation being performed
 * @returns {Object} Standardized error response
 */
function createErrorResponse(error, context, operation = 'unknown') {
    const correlationId = context?.invocationId || 
                         `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let statusCode = HTTP_STATUS_INTERNAL_ERROR;
    let errorType = 'InternalServerError';
    let userMessage = 'An unexpected error occurred. Please try again later.';
    
    // Categorize error types
    if (error.name === 'ValidationError' || error.message?.includes('validation')) {
        statusCode = HTTP_STATUS_BAD_REQUEST;
        errorType = 'ValidationError';
        userMessage = 'Invalid request parameters.';
    } else if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
        statusCode = HTTP_STATUS_UNAUTHORIZED;
        errorType = 'AuthenticationError';
        userMessage = 'Authentication failed.';
    } else if (error.message?.includes('forbidden') || error.message?.includes('permission')) {
        statusCode = HTTP_STATUS_FORBIDDEN;
        errorType = 'AuthorizationError';
        userMessage = 'Access denied.';
    } else if (error.message?.includes('not found')) {
        statusCode = HTTP_STATUS_NOT_FOUND;
        errorType = 'NotFoundError';
        userMessage = 'Requested resource not found.';
    } else if (error.message?.includes('rate limit') || error.status === HTTP_STATUS_RATE_LIMITED) {
        statusCode = HTTP_STATUS_RATE_LIMITED;
        errorType = 'RateLimitError';
        userMessage = 'Too many requests. Please try again later.';
    } else if (isRetryableError(error)) {
        statusCode = HTTP_STATUS_SERVICE_UNAVAILABLE;
        errorType = 'ServiceUnavailableError';
        userMessage = 'Service temporarily unavailable. Please try again.';
    }
    
    // Log the error for monitoring
    logWithEnv('error', `Error in ${operation}`, {
        errorType,
        errorMessage: error.message,
        errorStack: error.stack,
        operation,
        retryable: isRetryableError(error)
    }, context);
    
    return {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
            success: false,
            error: {
                type: errorType,
                message: userMessage,
                correlationId,
                timestamp: new Date().toISOString()
            }
        })
    };
}

/**
 * Wraps an async function with error handling and retry logic
 * @param {Function} fn - The function to wrap
 * @param {Object} options - Options for error handling
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, options = {}) {
    const {
        operation = 'unknown',
        maxRetries = MAX_RETRIES_TRANSIENT,
        retryDelay = 1000,
        timeout = DEFAULT_TIMEOUT_MS
    } = options;
    
    return async function wrappedFunction(request, context) {
        let lastError;
        let attempt = 0;
        const startTime = Date.now();
        
        while (attempt <= maxRetries) {
            try {
                // Add timeout wrapper
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout);
                });
                
                const result = await Promise.race([
                    fn(request, context),
                    timeoutPromise
                ]);
                
                // Log successful execution with retry info
                if (attempt > 0) {
                    logWithEnv('info', `Operation succeeded after retries`, {
                        operation,
                        attempts: attempt + 1,
                        duration: Date.now() - startTime
                    }, context);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                if (attempt <= maxRetries && isRetryableError(error)) {
                    const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    
                    logWithEnv('warn', `Operation failed, retrying`, {
                        operation,
                        attempt,
                        maxRetries,
                        delay,
                        error: error.message
                    }, context);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }
        
        // All retries exhausted
        return createErrorResponse(lastError, context, operation);
    };
}

/**
 * Input validation helper
 * @param {Object} params - Parameters to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
function validateInput(params, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
        const value = params[field];
        
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
        }
        
        if (value !== undefined && value !== null) {
            if (rules.type && typeof value !== rules.type) {
                errors.push(`${field} must be of type ${rules.type}`);
            }
            
            if (rules.min && value < rules.min) {
                errors.push(`${field} must be at least ${rules.min}`);
            }
            
            if (rules.max && value > rules.max) {
                errors.push(`${field} must be at most ${rules.max}`);
            }
            
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(`${field} format is invalid`);
            }
            
            if (rules.allowedValues && !rules.allowedValues.includes(value)) {
                errors.push(`${field} must be one of: ${rules.allowedValues.join(', ')}`);
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    logWithEnv,
    isRetryableError,
    createErrorResponse,
    withErrorHandling,
    validateInput,
    // Export HTTP status constants
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_RATE_LIMITED,
    HTTP_STATUS_INTERNAL_ERROR,
    HTTP_STATUS_BAD_GATEWAY,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    HTTP_STATUS_GATEWAY_TIMEOUT
};
