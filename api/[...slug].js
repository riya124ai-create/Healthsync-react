const path = require('path')

const app = require(path.join(__dirname, '..', 'backend', 'index.js'))

module.exports = (req, res) => {
  // Ensure the request stays unmodified and let Express handle routing
  return app(req, res)
}
