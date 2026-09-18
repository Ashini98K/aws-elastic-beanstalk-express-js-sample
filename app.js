const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('Hello World!'));

// Only bind a port when this file is executed directly (`node app.js`).
// When the test suite requires it instead, the app is handed back un-started so
// supertest can attach it to an ephemeral port. Without this guard the upstream
// version opens a real listener at require time, which leaves a dangling handle
// and hangs the test run in CI.
if (require.main === module) {
  app.listen(port, () => console.log(`App running on http://localhost:${port}`));
}

module.exports = app;
