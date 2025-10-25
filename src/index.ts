import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './config/db';
import { authorizeB2 } from './config/backblaze';
import router from './routes/index';
import { swaggerSpec } from './config/swagger';

dotenv.config();

// Initialize database and Backblaze B2
connectDB();
authorizeB2().catch((error) => {
  console.error('Failed to initialize Backblaze B2:', error);
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Memorly API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      documentation: '/api/v1/docs',
      swagger: '/api-docs',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Memorly API Documentation',
}));

app.use('/api/v1', router);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});