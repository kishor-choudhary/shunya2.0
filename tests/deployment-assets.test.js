"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");

test("deployment assets contain no symbolic links", () => {
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, `Deploy a regular file instead: ${file}`);
      if (entry.isDirectory()) inspect(file);
    }
  }
  for (const directory of ["uploads", "images", "_next", "paintings"]) {
    inspect(path.join(ROOT, directory));
  }
});

test("public aliases preserve the original image and all 50 frame contents", () => {
  const uploads = path.join(ROOT, "uploads");
  const aliases = [
    ["left.jpg", "WhatsApp Image 2026-10-17 at 12.12.10 PM (1).jpeg"],
    ["right.jpg", "WhatsApp Image 2026-10-17 at 12.12.10 PM.jpeg"]
  ];
  for (let i = 1; i <= 50; i++) {
    const frame = `ezgif-frame-${String(i).padStart(3, "0")}.jpg`;
    aliases.push([
      `frames/${frame}`,
      `WhatsApp_Video_2026-10-17_at_12.17.54_20261017152107/${frame}`
    ]);
  }
  for (const [alias, original] of aliases) {
    const file = path.join(uploads, alias);
    assert.ok(fs.lstatSync(file).isFile(), `${alias} must be a regular file`);
    assert.deepEqual(fs.readFileSync(file), fs.readFileSync(path.join(uploads, original)));
  }
});
