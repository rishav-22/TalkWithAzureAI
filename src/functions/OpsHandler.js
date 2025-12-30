const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require('@azure/identity');
const { ResourceGraphClient } = require('@azure/arm-resourcegraph');

app.http('OpsHandler', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log('Azure Ops Copilot: Processing request');

            const body = request.method === 'POST' ? await request.json() : {};
            const intent = body.intent || 'health';
            const subscriptionId = process.env.SUBSCRIPTION_ID;

            let result = {
                status: 'error',
                message: 'Unknown intent'
            };

            if (intent === 'health') {
                result = {
                    status: 'success',
                    data: [
                        { resource: 'web-vm01', cpu: '72%', memory: '65%', status: 'Healthy' },
                        { resource: 'db-vm02', cpu: '92%', memory: '88%', status: 'High CPU' }
                    ],
                    format: 'table',
                    message: 'Sample VM health data'
                };
            } else if (intent === 'security') {
                if (!subscriptionId) {
                    result = {
                        status: 'error',
                        message: 'SUBSCRIPTION_ID not set in settings'
                    };
                } else {
                    const credential = new DefaultAzureCredential();
                    const rgClient = new ResourceGraphClient(credential);

                    const queryResult = await rgClient.resources({
                        query: "Resources | where type =~ 'microsoft.compute/virtualmachines' | project name, resourceGroup, location | limit 5",
                        subscriptions: [subscriptionId]
                    });

                    const rows = (queryResult.data || []).map(r => ({
                        name: r.name,
                        resourceGroup: r.resourceGroup,
                        location: r.location
                    }));

                    result = {
                        status: 'success',
                        data: rows,
                        format: 'table',
                        count: rows.length,
                        message: `Found ${rows.length} VMs via Resource Graph`
                    };
                }
            } else if (intent === 'cost') {
                result = {
                    status: 'success',
                    data: {
                        totalCost: '$1,234.56',
                        topServices: [
                            'VMs: $789 (64%)',
                            'Storage: $345 (28%)',
                            'SQL: $100 (8%)'
                        ],
                        timeframe: 'Last 7 days'
                    },
                    format: 'summary'
                };
            }

            return {
                status: 200,
                jsonBody: result
            };
        } catch (err) {
            context.log.error('Error in OpsHandler:', err);
            return {
                status: 500,
                jsonBody: {
                    status: 'error',
                    message: err.message
                }
            };
        }
    }
});
