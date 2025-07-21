const { app } = require('@azure/functions');

app.setup({
    enableHttpStream: true,
});

// Health and monitoring endpoints
require('./functions/healthCheck');
require('./functions/ping');
require('./functions/testDBconnection');
require('./functions/resetCircuitBreaker');

// Core API endpoints
require('./functions/fetchPowermetersByUserAccess');
require('./functions/fetchRealTimeData');
require('./functions/postMeasurement');
require('./functions/powermeter');
require('./functions/measurementRange');
require('./functions/downloads');

// Support endpoints
require('./functions/supportedModels');
require('./functions/supportedTimeZones');
require('./functions/httpTrigger1');

// Import all Analysis Endpoints
require('./functions/Analysis Endpoints/consumptionHistory');
require('./functions/Analysis Endpoints/consumptionProfile');
require('./functions/Analysis Endpoints/demandHistory');
require('./functions/Analysis Endpoints/demandProfile');
require('./functions/Analysis Endpoints/thdCurrentHistory');
require('./functions/Analysis Endpoints/thdCurrentProfile');
require('./functions/Analysis Endpoints/thdVoltageLLHistory');
require('./functions/Analysis Endpoints/thdVoltageLLProfile');
require('./functions/Analysis Endpoints/thdVoltageLNHistory');
require('./functions/Analysis Endpoints/thdVoltageLNProfile');
require('./functions/Analysis Endpoints/monthlyReport');
require('./functions/Analysis Endpoints/loadCenters');