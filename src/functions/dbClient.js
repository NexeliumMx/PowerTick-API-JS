const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

let pool;

// Function to initialize and return a connection pool
async function initPool() {
    if (pool) {
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
    return pool.connect(); // Returns a pooled client
}

module.exports = { getClient };