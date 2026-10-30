import { spawn } from "node:child_process";
import { resolve } from "node:path";
const mode = process.argv[2];
const commands = {
  start: ["emulators:start", "--only", "auth,firestore"],
  test: [
    "emulators:exec",
    "--only",
    "auth,firestore",
    "npm run test:emulators:run",
  ],
  auth: ["emulators:exec", "--only", "auth", "npm run test:auth-emulator:run"],
};
if (!Object.hasOwn(commands, mode))
  throw new Error("Choose start, test or auth.");
const child = spawn(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    ...commands[mode],
    "--project",
    "demo-jobtrack",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "true",
      DEBUG: "",
      XDG_CONFIG_HOME: resolve(".firebase-cli"),
      FIREBASE_EMULATORS_PATH: resolve(".firebase-cli/emulators"),
      FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
