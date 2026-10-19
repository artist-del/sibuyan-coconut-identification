import assert from "node:assert/strict";
import { loadWithCacheRecovery } from "../lib/model-loading";
import { screeningFailureMessage } from "../lib/screening";
async function main() {
  const attempts: boolean[] = [];
  assert.equal(await loadWithCacheRecovery(async (cached) => { attempts.push(cached); if (cached) throw new Error("CacheStorage failed"); return "ready"; }), "ready");
  assert.deepEqual(attempts, [true, false]);
  let count = 0;
  await assert.rejects(loadWithCacheRecovery(async () => { count++; throw new Error("Failed to fetch"); }));
  assert.equal(count, 1);
  assert.match(screeningFailureMessage(new Error("Failed to fetch https://private.example"), "load"), /MODEL_NETWORK/);
  assert.ok(!screeningFailureMessage(new Error("Failed to fetch https://private.example"), "load").includes("private.example"));
  console.log("Model cache recovery and safe download diagnostics passed.");
}
main().catch(() => { console.error("Model loading regression failed"); process.exitCode = 1; });
