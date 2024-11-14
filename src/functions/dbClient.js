const { DefaultAzureCredential } = require("@azure/identity");
const { Client } = require("pg");

let client;

// Function to initialize and connect the PostgreSQL client
async function initClient() {
    try {
        if (client) {
            return client;  // Reuse the existing client if already connected
        }

        if (process.env.ENVIRONMENT === "local") {
            console.log("Running locally. Using traditional user/password authentication.");
            client = new Client({
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

            client = new Client({
                host: process.env.PGHOST,
                database: process.env.PGDATABASE,
                port: process.env.PGPORT || 5432,
                ssl: { rejectUnauthorized: false },
                user: process.env.PGUSER,
                password: tokenResponse.token
            });
        }

        await client.connect();
        console.log("Connection to database successful.");
        return client;
    } catch (error) {
        console.error("Database connection error:", error);
        throw new Error(`Connection to database failed: ${error.message}`);
    }
}

// Function to get the connected client, ensuring it's initialized
async function getClient() {
    return client || await initClient();
}

module.exports = { getClient };