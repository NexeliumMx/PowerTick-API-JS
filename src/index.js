const { app } = require('@azure/functions');

app.setup({
    enableHttpStream: true,
});

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