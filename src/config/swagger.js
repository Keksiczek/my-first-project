const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Warehouse System API',
      version: '1.0.0',
      description: 'REST API pro skladový systém – objednávky, příjem, inventář a pohyby materiálu.'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Orders', description: 'Správa objednávek' },
      { name: 'Receive', description: 'Příjem materiálu' },
      { name: 'Inventory', description: 'Zásoby na skladě' },
      { name: 'Movements', description: 'Historie pohybů' },
      { name: 'Import', description: 'Import dat z CSV' },
      { name: 'Excel Import', description: 'Import objednávek a soupisů z Excelu' },
      { name: 'Health', description: 'Health-check endpoint' },
      { name: 'Home', description: 'Dashboard a přehled systému' },
      { name: 'Warehouses', description: 'Správa skladů' },
      { name: 'WarehousePositions', description: 'Skladové pozice a kapacity' },
      { name: 'Production', description: 'Výrobní dávky a plánování' },
      { name: 'ProductionStages', description: 'Řízení mezioperací' },
      { name: 'SubProducts', description: 'Evidence mezivýrobků' },
      { name: 'ProductionQuality', description: 'Kontroly kvality ve výrobě' },
      { name: 'Exports', description: 'Exporty a reporting' },
      { name: 'Assembly', description: 'Stromové zakázky a montáže' },
      { name: 'Quality', description: 'Kontroly kvality' }
    ],
    components: {
      schemas: {
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Chybová zpráva' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
