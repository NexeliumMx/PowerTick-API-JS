const { app } = require('@azure/functions');
const { getClient } = require('../dbClient');

const ALLOWED_ENVIROMENTS = ['production', 'demo', 'dev'];

function getSchema(env) {
    if (!env || env === 'production') return 'public';
    if (ALLOWED_ENVIROMENTS.includes(env)) return env;
    return null;
}

app.http('thdVoltageLNProfile', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
                       
    }
});
