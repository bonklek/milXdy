import { spawn } from "node:child_process";
import { basename } from "node:path";
import { releaseBuilds } from "../release/release-builds.mjs";

for (const build of releaseBuilds) {
  console.log(`Building milXdy ${build.target}/${build.profile}/${build.channel}...`);
  await run(process.execPath, [
    "scripts/build/build-extension.mjs",
    `--target=${build.target}`,
    `--profile=${build.profile}`,
    `--channel=${build.channel}`,
  ]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${basename(command)} failed with exit code ${code}`));
    });
  });
}
