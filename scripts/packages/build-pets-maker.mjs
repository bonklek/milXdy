import { mkdir } from "node:fs/promises";
import esbuild from "esbuild";

const packageRoot = "examples/packages/local-dev/pets-maker";
await mkdir(`${packageRoot}/dist`, { recursive: true });
await esbuild.build({
  entryPoints: [`${packageRoot}/src/content.js`],
  outfile: `${packageRoot}/dist/content.js`,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
  legalComments: "none",
});
