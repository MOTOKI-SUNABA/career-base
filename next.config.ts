import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

function buildCommit() {
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deploymentCommit && /^[a-f\d]{40}$/i.test(deploymentCommit)) return deploymentCommit.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_COMMIT: buildCommit() },
};

export default nextConfig;
