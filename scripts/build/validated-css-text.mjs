import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

export async function validateCssText(contents, sourcefile) {
  if (/\$\{|\b(?:export\s+const|const\s+\w+\s*=)|`/u.test(contents)) {
    throw new Error(`${sourcefile}: unevaluated JavaScript in stylesheet`);
  }
  const { warnings } = await transform(contents, { loader: "css", sourcefile, logLevel: "silent" });
  if (warnings.length) throw new Error(`${sourcefile}: invalid stylesheet: ${warnings.map(w => w.text).join("; ")}`);
  return contents;
}

/** Validate styles before bundling them as text for runtime injection. */
export function validatedCssTextPlugin() {
  return {
    name: "validated-css-text",
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => ({
        contents: await validateCssText(await readFile(path, "utf8"), path),
        loader: "text",
        watchFiles: [path],
      }));
    },
  };
}
