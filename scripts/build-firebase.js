const { spawnSync } = require("child_process");
const path = require("path");

const env = {
  ...process.env,
  NEXT_DEPLOY_TARGET: "firebase-hosting",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const nextBin = path.join("node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

run(nextBin, ["build"]);
run(process.execPath, [path.join(__dirname, "generate-firebase-config.js")]);
