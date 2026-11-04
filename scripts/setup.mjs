// One-command local setup: node scripts/setup.mjs
// Creates .env with fresh secrets, starts Postgres in Docker, creates tables, seeds data.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const has = (cmd) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

console.log("1/5 Checking tools...");
if (Number(process.versions.node.split(".")[0]) < 20) {
  console.error("Node 20 or newer is required. Install it from https://nodejs.org");
  process.exit(1);
}
const dockerOk = has("docker info");
if (!dockerOk) {
  console.error("Docker is not running. Start Docker Desktop and run this again.");
  console.error("(Or use your own Postgres 16 and set DATABASE_URL in .env, then run: npx prisma db push && npm run db:seed)");
  process.exit(1);
}

console.log("2/5 Writing .env...");
if (!existsSync(".env")) {
  const env = [
    'DATABASE_URL="postgresql://mayaleen:mayaleen@localhost:5432/mayaleen"',
    `SESSION_SECRET="${randomBytes(32).toString("hex")}"`,
    `FIELD_ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"`,
    "",
  ].join("\n");
  writeFileSync(".env", env);
  console.log("   created .env with new random secrets");
} else {
  console.log("   .env already exists, keeping it");
}

console.log("3/5 Starting the database...");
run("docker compose up -d db");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  ready = has("docker compose exec -T db pg_isready -U mayaleen");
  if (!ready) await wait(1500);
}
if (!ready) {
  console.error("Database did not start in time. Check: docker compose logs db");
  process.exit(1);
}

console.log("4/5 Installing packages and creating tables...");
if (!existsSync("node_modules")) run("npm install");
run("npx prisma generate");
run("npx prisma db push --skip-generate");

console.log("5/5 Adding starter data...");
run("npm run db:seed");

console.log(`
Done. Start the app with:   npm run dev
Then open:                  http://localhost:3000/admin/login
Sign in with mobile 01700000000 and password changeme-dev  (change it before real use)
`);
