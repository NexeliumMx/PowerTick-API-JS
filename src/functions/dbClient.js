/**
 * Author: Arturo Vargas Cuevas
 * Last Modified Date: 21-11-2024
 *
 * This module provides a database connection pool using the `pg` library for PostgreSQL.
 * It supports two environments:
 * - **Local Development**: Utilizes traditional username/password authentication.
 * - **Azure Environment**: Implements token-based authentication with Azure Managed Identity.
 *
 * Key Features:
 * - Initializes a connection pool (`initPool`) to manage database connections efficiently.
 * - Reuses the pool if it has already been created, optimizing resource usage.
 * - Uses `DefaultAzureCredential` to retrieve authentication tokens for Azure.
 * - Provides a function (`getClient`) to fetch a database client from the pool for executing queries.
 *
 * Conditions for the Code to Work:
 * - Environment variables (`PGHOST`, `PGDATABASE`, `PGPORT`, `PGUSER`, `PGPASSWORD`) must be correctly set.
 * - For Azure, Managed Identity must be configured and the application must have access to the PostgreSQL server.
 * - A valid token must be retrievable from Azure Managed Identity.
 *
 * How to import to other codes:
 * const { getClient } = require('./dbClient');
 */

const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

let pool;

// Function to initialize and return a connection pool
async function initPool() {
    if (pool) {
        console.log("Reusing existing connection pool.");
        return pool;  // Reuse the existing pool if already created
    }

    if (process.env.ENVIRONMENT === "local") {
        console.log("Running locally. Using traditional user/password authentication.");
        pool = new Pool({
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            port: process.env.PGPORT || 5432,
            ssl: { rejectUnauthorized: false },
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD
        });
    } else {
        console.log("Running in Azure. Using token-based authentication with managed identity.");
        const credential = new DefaultAzureCredential();
        const tokenResponse = await credential.getToken("https://ossrdbms-aad.database.windows.net");

        if (!tokenResponse || typeof tokenResponse.token !== 'string') {
            console.error("Failed to retrieve a valid token.");
            throw new Error("Invalid token retrieved from Azure Managed Identity.");
        }

        pool = new Pool({
            host: process.env.PGHOST,
            database: process.env.PGDATABASE,
            port: process.env.PGPORT || 5432,
            ssl: { rejectUnauthorized: false },
            user: process.env.PGUSER,
            password: tokenResponse.token
        });
    }

    console.log("Connection pool initialized.");
    return pool;
}

// Export function to get a client from the pool
async function getClient() {
    const pool = await initPool();
    console.log("Fetching a client from the pool.");
    return pool.connect(); // Returns a pooled client
}

module.exports = { getClient };