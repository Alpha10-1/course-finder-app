// Writes public/.well-known/assetlinks.json for the Android app.
//
//   npm run assetlinks -- --fingerprint <SHA-256> [--fingerprint <SHA-256>] [--package <name>]
//
// Pass your upload key's fingerprint, plus Google Play's app signing key
// fingerprint once the app is on Play (Play Console → Protected with Play →
// Play Store distribution → Go to Play app signing → App signing key
// certificate). Then build and deploy hosting as usual.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssetLinks, DEFAULT_PACKAGE } from "./assetlinks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "public/.well-known/assetlinks.json");

function parseArgs(argv) {
  const args = { packageName: DEFAULT_PACKAGE, fingerprints: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--package" && value) { args.packageName = value; i += 1; }
    else if (flag === "--fingerprint" && value) { args.fingerprints.push(value); i += 1; }
    else throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  return args;
}

try {
  const { packageName, fingerprints } = parseArgs(process.argv.slice(2));
  const json = `${JSON.stringify(buildAssetLinks(packageName, fingerprints), null, 2)}\n`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, json);
  console.log(`Wrote ${path.relative(root, outFile)} for ${packageName} (${fingerprints.length} fingerprint(s)).`);
  console.log("Next: npm run build && firebase deploy --only hosting");
} catch (err) {
  console.error(err.message);
  console.error("Usage: npm run assetlinks -- --fingerprint <SHA-256> [--fingerprint <SHA-256>] [--package <name>]");
  process.exit(1);
}
