import { spawn } from "node:child_process";
const firestore = process.env.FIRESTORE_EMULATOR_HOST;
const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (
  !/^(127\.0\.0\.1|localhost):8080$/.test(firestore ?? "") ||
  !/^(127\.0\.0\.1|localhost):9099$/.test(auth ?? "")
) {
  throw new Error(
    "Only the explicit local Auth and Firestore emulators may run these tests.",
  );
}
const child = spawn(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.emulator.config.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, JOBTRACK_EMULATOR_TESTS: "true" },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
