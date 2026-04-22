const { rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

rmSync(".next", { recursive: true, force: true });

const env = {
  ...process.env,
  BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "true",
  BROWSERSLIST_IGNORE_OLD_DATA: "true",
};

const nextBin = require.resolve("next/dist/bin/next");
const command = process.execPath;
const args = [nextBin, "build", "--turbopack"];

const result = spawnSync(command, args, {
  stdio: "inherit",
  env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error);
}

process.exit(1);
