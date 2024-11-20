const { app } = require('@azure/functions');
const { getClient } = require('./dbClient'); // Import your existing dbClient.js

app.http('registerNewMeter', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const client = getClient(); // Use your existing database client

        try {
            // Connect to the database
            await client.connect();

            // Parse the JSON payload
            const meters = await request.json();
            if (!Array.isArray(meters)) {
                return { status: 400, body: 'Invalid input: Expected an array of meters.' };
            }

            for (const meter of meters) {
                // Dynamically construct column names and values from the JSON attributes
                const columns = Object.keys(meter).join(', ');
                const values = Object.values(meter)
                    .map((value, index) => `$${index + 1}`)
                    .join(', ');

                // SQL query for insertion
                const query = `
                    INSERT INTO demo.powermeters (${columns}, register_date)
                    VALUES (${values}, NOW())
                `;

                // Execute the query
                await client.query(query, Object.values(meter));
                context.log(`Inserted meter with serial_number: ${meter.serial_number}`);
            }

            return { status: 200, body: 'Meters successfully registered.' };
        } catch (error) {
            context.log.error('Error inserting meters:', error);
            return { status: 500, body: `Error: ${error.message}` };
        } finally {
            // Close the database connection
            await client.end();
        }
    },
});
