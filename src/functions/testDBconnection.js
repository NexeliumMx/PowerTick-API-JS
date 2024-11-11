const { DefaultAzureCredential } = require("@azure/identity");
const { Client } = require("pg");
const { app } = require('@azure/functions');

app.http('testDBconnection', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Function to connect to the PostgreSQL database
        async function connectToDatabase() {
            try {
                // Initialize DefaultAzureCredential for managed identity authentication
                const credential = new DefaultAzureCredential();
                const tokenResponse = await credential.getToken("https://ossrdbms-aad.database.windows.net");

                // Create a new PostgreSQL client using the access token as the password
                const client = new Client({
                    host: process.env.PGHOST,
                    database: process.env.PGDATABASE,
                    port: process.env.PGPORT || 5432,
                    ssl: { rejectUnauthorized: false },  // Enable SSL for secure connection
                    password: tokenResponse.token  // Use the token as the password
                });

                // Connect to the database
                await client.connect();

                // If the connection is successful, close the client and return success message
                await client.end();
                return { success: true, message: "Connection to database successful." };
            } catch (error) {
                // If an error occurs, return failure message with the error
                return { success: false, message: `Connection to database failed: ${error.message}` };
            }
        }

        // Call the function to test the connection
        const result = await connectToDatabase();

        // Return the result as the HTTP response
        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };
    }
});
