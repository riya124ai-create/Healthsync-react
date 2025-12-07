// Vercel catch-all function that forwards all /api/* requests to the Express app
// exported from backend/index.js. This keeps your existing route structure
// (which mounts under /api) intact.

const path = require('path')

// require the app exported from backend/index.js
const app = require(path.join(__dirname, '..', 'backend', 'index.js'))

// Express apps are callable as request handlers: (req, res) => { ... }
module.exports = (req, res) => {
  // Ensure the request stays unmodified and let Express handle routing
  return app(req, res)
}
