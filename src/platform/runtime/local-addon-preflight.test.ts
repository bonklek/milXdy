import { describe, expect, it } from "vitest";
import { preflightLocalAddonZip } from "./content-runtime";

describe("local add-on ZIP browser preflight", () => {
  it("accepts a root manifest and exposes package metadata", async () => {
    const file = storedZip("dev-note.zip", {
      "milxdy.app.json": JSON.stringify({
        manifestVersion: 1,
        id: "dev-note",
        name: "Dev Note",
        version: "1.0.0",
        description: "A local note.",
        packageKind: "feature",
        sdk: { minVersion: "0.2.3" },
        contentEntry: "dist/content.js",
      }),
      "dist/content.js": "export function boot() {}",
    });

    await expect(preflightLocalAddonZip(file)).resolves.toMatchObject({
      state: "accepted",
      id: "dev-note",
      name: "Dev Note",
      version: "1.0.0",
    });
  });

  it("rejects a manifest nested below the ZIP root", async () => {
    const file = storedZip("nested.zip", {
      "nested/milxdy.app.json": "{}",
    });

    await expect(preflightLocalAddonZip(file)).resolves.toMatchObject({
      state: "rejected",
      reason: "milxdy.app.json must be at the ZIP root.",
    });
  });

  it("rejects unsafe archive paths before reading package code", async () => {
    const file = storedZip("unsafe.zip", {
      "milxdy.app.json": "{}",
      "../escape.js": "bad",
    });

    await expect(preflightLocalAddonZip(file)).resolves.toMatchObject({
      state: "rejected",
      reason: "Unsafe ZIP path: ../escape.js.",
    });
  });
});

function storedZip(name: string, files: Record<string, string>): File {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const [fileName, contents] of Object.entries(files)) {
    const nameBytes = encoder.encode(fileName);
    const data = encoder.encode(contents);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, centralParts.length, true);
  eocdView.setUint16(10, centralParts.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, localOffset, true);

  const blobParts = [...localParts, ...centralParts, eocd].map((part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer);
  return new File(blobParts, name, { type: "application/zip" });
}
