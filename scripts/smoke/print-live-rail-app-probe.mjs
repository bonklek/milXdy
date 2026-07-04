import { readFile } from "node:fs/promises";

const probe = await readFile("scripts/smoke/live-rail-app-probe.js", "utf8");

console.log("Paste this snippet into the X/Twitter page console after reloading the unpacked milXdy build:");
console.log("");
console.log(probe);
console.log("");
console.log("The result is also stored on window.__milxdyLiveRailAppProbe.");
