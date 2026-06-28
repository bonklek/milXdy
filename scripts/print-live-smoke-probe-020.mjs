import { readFile } from "node:fs/promises";

const probe = await readFile("scripts/live-smoke-probe-020.js", "utf8");

console.log("Paste this snippet into the X/Twitter page console after loading the unpacked 0.2.0 build:");
console.log("");
console.log(probe.trim());
