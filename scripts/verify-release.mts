import process from "node:process";

import { runVerificationCli } from "./verification/cli.mts";

runVerificationCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nVerification harness failed: ${message}`);
    process.exitCode = 1;
  });
