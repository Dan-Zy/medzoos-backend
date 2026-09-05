const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const stripeGateway = require('./modules/payments/gateways/stripe');
const env = require('./config/env');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();

try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch(e) {
  console.log('Swagger document not found or yamljs not installed, skipping api-docs.');
}

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', routes);

// Stripe may redirect to the API domain by mistake — forward to the customer app
app.get('/checkout', async (req, res, next) => {
  try {
    let targetBase = env.FRONTEND_URL || 'http://localhost:3000';

    if (req.query.session_id) {
      const session = await stripeGateway.retrieveCheckoutSession(String(req.query.session_id));
      if (session?.metadata?.return_base_url) {
        targetBase = session.metadata.return_base_url;
      }
    }

    targetBase = targetBase.replace(/\/$/, '');
    const query = new URLSearchParams(
      Object.entries(req.query).reduce((acc, [key, value]) => {
        if (typeof value === 'string') acc[key] = value;
        return acc;
      }, {})
    ).toString();

    return res.redirect(302, `${targetBase}/checkout${query ? `?${query}` : ''}`);
  } catch (error) {
    return next(error);
  }
});

// Serve static upload files fallback with CORS and Range support
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  },
  express.static(path.join(__dirname, '../public/uploads'), {
    acceptRanges: true,
    cacheControl: true,
    maxAge: '1d',
  })
);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
