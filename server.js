// Startup file for hosts that run Node.js apps through Phusion Passenger
// (cPanel "Setup Node.js App"). Vercel and `npm start` do not use it.
// Run `npm run build` once before starting it.
const { createServer } = require("http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Mayaleen is running on port ${port}`);
  });
});
