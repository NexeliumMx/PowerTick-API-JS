const { app } = require('@azure/functions');
const { ReadData } = require('./sql_connect.js');
const { createObjectCsvStringifier } = require('csv-writer');

app.http('httpTrigger1', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (req, context) => {
        context.log(`HTTP function processed request for URL "${req.url}"`);
        
        let model = req.query.model || (req.body && req.body.model);

        if (!model) {
            context.res = {
                status: 400,
                body: "No 'model' parameter in the query string or request body."
            };
            return;
        }

        try {
            const data = await ReadData(model);
            
            if (!data.rows || data.rows.length === 0) {
                context.res = {
                    status: 404,
                    body: `No records found for model '${model}'.`
                };
                return;
            }

            const header = Object.keys(data.rows[0]).map(key => ({ id: key, title: key }));
            const csvStringifier = createObjectCsvStringifier({ header });
            const csvData = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data.rows);

            context.res = {
                status: 200,
                isRaw: true,
                headers: { 
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename=modbusqueries_${model}.csv`
                },
                body: csvData
            };
        } catch (error) {
            context.log.error('An error occurred: ', error);
            context.res = {
                status: 500,
                body: 'An internal error occurred.'
            };
        }
    }
});