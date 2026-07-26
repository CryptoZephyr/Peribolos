import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const children = [];

function start(name, cmd, args, cwd) {
  console.log(`🚀 Starting ${name}: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  child.on("exit", (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });
  return child;
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

console.log("==================================================================");
console.log("🚀 STARTING PERIBOLOS V2 PRODUCTION STACK");
console.log("   - Backend API & Indexer: http://localhost:3400");
console.log("   - Instant Dashboard V2:  http://localhost:3000");
console.log("==================================================================");

start("api", npx, ["tsx", "src/server.ts"], join(root, "apps/api"));
start("dashboard", npm, ["run", "start", "-w", "@peribolos/dashboard"], root);
