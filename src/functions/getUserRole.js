const { app } = require('@azure/functions');

app.http('getUserRole', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        const userId = request.query.get('user_id');
        if (!userId) {
            context.log('user_id is missing in the request');
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: 'user_id is required' })
            };
        }
        try{
        const query = `
                SELECT 
                    rol
                FROM 
                    users
                WHERE 
                    user_id = $1;
            `;
            const values = [userId];
            context.log(`Executing query: ${query} with values: ${values}`);
            const res = await executeQuery(query, values);

            context.log("Database query executed successfully:", res.rows);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows)
            };
        } catch (error) {
            context.log.error("Error during database operation:", error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, message: `Database operation failed: ${error.message}` })
            };
        }
}
});
