import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "milxdy-share-kit-layout-"));
try {
  const bundlePath = path.join(temporaryRoot, "benchmark.js");
  await esbuild.build({
    entryPoints: ["scripts/benchmarks/share-kit-text-layout-browser.ts"],
    outfile: bundlePath,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    sourcemap: false,
  });
  const bundle = await readFile(bundlePath, "utf8");
  const htmlPath = path.join(temporaryRoot, "benchmark.html");
  await writeFile(htmlPath, `<!doctype html><meta charset="utf-8"><body><script>${bundle}</script></body>`, "utf8");
  const output = await runChrome(chrome, pathToFileURL(htmlPath).href);
  const match = output.match(/<pre id="result">([\s\S]*?)<\/pre>/u);
  if (!match) throw new Error(`Benchmark result missing from Chrome output:\n${output}`);
  console.log(decodeHtml(match[1]));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function runChrome(executable, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--dump-dom",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Chrome exited ${code}: ${stderr}`));
    });
  });
}

function decodeHtml(value) {
  return value.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");
}
