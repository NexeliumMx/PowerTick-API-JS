/**
 * File: queryOptimizer.js
 * Author(s): Arturo Vargas
 * Brief: Query performance optimization utilities
 * Date: 2025-07-18
 * 
 * Copyright (c) 2025 BY: Nexelium Technological Solutions S.A. de C.V.
 * All rights reserved.
 */

// Constants following coding instructions
const SLOW_QUERY_THRESHOLD_MS = 1000;
const QUERY_CACHE_SIZE = 100;
const QUERY_CACHE_TTL_MS = 600000; // 10 minutes

// Simple LRU cache for prepared statements
class QueryCache {
    constructor(maxSize = QUERY_CACHE_SIZE) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        return null;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

const queryCache = new QueryCache();

/**
 * Optimizes query by analyzing patterns and suggesting improvements
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Object} Query optimization suggestions
 */
function analyzeQuery(query, params = []) {
    const normalizedQuery = query.trim().toLowerCase();
    const suggestions = [];
    
    // Check for SELECT * usage
    if (normalizedQuery.includes('select *')) {
        suggestions.push({
            type: 'SELECT_STAR',
            message: 'Consider specifying exact columns instead of SELECT *',
            severity: 'warning'
        });
    }
    
    // Check for missing WHERE clause in UPDATE/DELETE
    if ((normalizedQuery.startsWith('update') || normalizedQuery.startsWith('delete')) 
        && !normalizedQuery.includes('where')) {
        suggestions.push({
            type: 'MISSING_WHERE',
            message: 'UPDATE/DELETE without WHERE clause detected',
            severity: 'critical'
        });
    }
    
    // Check for potential N+1 queries
    if (normalizedQuery.includes('limit 1') && normalizedQuery.includes('join')) {
        suggestions.push({
            type: 'POTENTIAL_N_PLUS_ONE',
            message: 'Consider using batch queries instead of multiple single-record fetches',
            severity: 'info'
        });
    }
    
    return {
        queryId: generateQueryId(query),
        suggestions,
        parameterized: params.length > 0,
        complexity: calculateQueryComplexity(normalizedQuery)
    };
}

/**
 * Generates a unique ID for query caching
 * @param {string} query - SQL query
 * @returns {string} Query ID
 */
function generateQueryId(query) {
    // Simple hash for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
        const char = query.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Calculates query complexity score
 * @param {string} query - Normalized SQL query
 * @returns {number} Complexity score (1-5)
 */
function calculateQueryComplexity(query) {
    let complexity = 1;
    
    // Add complexity for joins
    const joinCount = (query.match(/join/g) || []).length;
    complexity += joinCount * 0.5;
    
    // Add complexity for subqueries
    const subqueryCount = (query.match(/\(/g) || []).length;
    complexity += subqueryCount * 0.3;
    
    // Add complexity for aggregations
    const aggCount = (query.match(/count|sum|avg|max|min|group by/g) || []).length;
    complexity += aggCount * 0.2;
    
    return Math.min(5, Math.round(complexity));
}

/**
 * Wraps query execution with performance monitoring
 * @param {Function} executeQuery - Original executeQuery function
 * @returns {Function} Enhanced executeQuery function
 */
function withQueryOptimization(executeQuery) {
    return async function optimizedExecuteQuery(query, params = []) {
        const startTime = Date.now();
        const analysis = analyzeQuery(query, params);
        
        try {
            const result = await executeQuery(query, params);
            const duration = Date.now() - startTime;
            
            // Log slow queries
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                console.warn(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    level: 'warn',
                    message: 'Slow query detected',
                    env: process.env.ENVIRONMENT || 'unknown',
                    service: 'query-optimizer',
                    queryId: analysis.queryId,
                    duration,
                    complexity: analysis.complexity,
                    suggestions: analysis.suggestions,
                    query: query.substring(0, 200) + '...'
                }));
            }
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                message: 'Query execution failed',
                env: process.env.ENVIRONMENT || 'unknown',
                service: 'query-optimizer',
                queryId: analysis.queryId,
                duration,
                complexity: analysis.complexity,
                error: error.message,
                query: query.substring(0, 200) + '...'
            }));
            
            throw error;
        }
    };
}

module.exports = {
    analyzeQuery,
    withQueryOptimization,
    QueryCache,
    queryCache
};
