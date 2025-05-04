const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Cấu hình Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Travel Planner API',
      version: '1.0.0',
      description: 'API cho ứng dụng gợi ý hành trình du lịch dựa trên sở thích cá nhân',
      contact: {
        name: 'Travel Planner Team'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'API xác thực người dùng'
      },
      {
        name: 'Itinerary',
        description: 'API quản lý hành trình du lịch'
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Đường dẫn đến các file chứa JSDoc
};

const specs = swaggerJsdoc(options);

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Travel Planner API Documentation'
  })
}; 