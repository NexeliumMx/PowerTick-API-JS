const { Client } = require('pg')

//Azure postgresql connection SDK
const dbConfig = {
    user: 'superadmin',//process.env.DB_USER,
    host: 'powertic.postgres.database.azure.com',//process.env.DB_HOST,
    database: 'PowerTick',//process.env.DB_NAME,
    password: 'vafja6-hexpem-javdyN',//process.env.DB_PASSWORD,
    port: 5432,
    ssl: {rejectUnauthorized: false}

};

//Data extraction from the database
async function ReadData(model){
    const clientpg = new Client(dbConfig);
    try {
        await clientpg.connect();
        const query = 'SELECT * FROM public.modbusrtu_commands WHERE model = $1'
        const res = await clientpg.query(queryText, [model]);

        if (res.rows.length === 0) {
            context.res = {
                status: 404, 
                body: `No record found for model '${model}'.`
            };
            return;
        }

    } catch (error) {
        context.log.error('An error occurred: ', error);
        context.res = {
            status: 500,
            body: 'An internal error occurred.'
        };
    } finally {
        await clientpg.end();
    }
};
