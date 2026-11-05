---
name: toss-api-release
description: Check the official Toss Securities REST OpenAPI version, update the Toss SDK and MCP server when it increases, and prepare and push a tagged release. Use for an explicit Toss API update and release request; a check-only request must not publish.
---

# Toss API update and release

Run this workflow from the root of the `toss-invest-sdk` repository. An explicit invocation requesting this release authorizes the release commit, version tag, and normal push that triggers GitHub Actions. A request to check or prepare only does not authorize those actions. Never force-push, amend, reset, overwrite tags, include unrelated work, or publish directly as a workaround.

## 1. Check the repository and upstream

1. Read applicable repository instructions. Inspect `git status -sb`, the current branch, recent commits, the remote, `packages/sdk/openapi-ts.config.ts`, `packages/sdk/src/generated/spec.json`, and `.github/workflows/publish.yml`. Fetch the remote branch and tags without changing the working tree. If there are staged or unstaged changes, an unexpected branch, local/remote divergence, or unrelated unpushed commits, stop before modifying or pushing and explain what needs resolution; never rewrite the user's work.
2. Download the configured official `latest/openapi.json` to a temporary file. Compare its `info.version`, paths, operations, and schemas with the saved spec. Compare versions as semver. If the official version is not greater, do not create a release. If the content changed despite the same version, report the difference and ask how to proceed. If the version is invalid, lower, or the download fails, report the problem instead of guessing.

## 2. Update the SDK and MCP

1. Run `pnpm generate`. Confirm the saved generated spec matches the downloaded snapshot as parsed JSON. If upstream changed during generation, recheck before continuing; never silently release an inconsistent snapshot. Review the spec and generated diff for added, removed, and changed endpoints and request/response schemas.
2. Inspect affected callers, `apps/mcp/src/server.ts`, generated request schemas, tests, exports, and docs. Adapt existing MCP tools to changed API contracts. Expose new applicable REST operations as MCP tools using existing SDK and Zod patterns, descriptions, and annotations. Account calls must use the selected account header. New trading mutations must retain the existing opt-in and order safety rules. Do not silently expose mutations as read-only. If a safe mapping is unclear, stop and explain rather than inventing behavior.
3. Update relevant tests and `apps/mcp/README.md`. Check request serialization, validation, and pagination when applicable. Add focused tests for new behavior and compatibility; do not test only generated implementation details.

## 3. Prepare and verify the release

1. Check the latest published versions of both npm packages and existing local and remote `v*` tags. Choose the next shared package version using project history and semver: patch for compatible fixes/documentation, minor for compatible added APIs, and an appropriate breaking-change increment for incompatible changes (in `0.x`, increment the minor version for breaking changes). It must exceed both published versions and must not reuse an existing tag. Upstream API version and package version are independent.
2. Set the same package version in `packages/sdk/package.json`, `apps/mcp/package.json`, `apps/mcp/server.json` (both version fields), and the MCP server identity in `apps/mcp/src/server.ts`; update any other actual version references discovered. Check workspace dependency resolution and lockfile as needed. Confirm the release workflow still runs on `v*` tags, uses the same version fields, runs checks, publishes the SDK before MCP, waits for npm visibility, and registers MCP. Preserve its existing authentication and notification settings.
3. Run `pnpm check`, `pnpm test`, and `git diff --check`. Pack both packages to a temporary directory and verify the MCP tarball references the intended SDK version. Inspect the full diff and ensure only this release is included. If checks fail, fix and rerun the affected checks. Do not tag or push an unverified release.

## 4. Commit, push, and verify deployment

1. Recheck status, current branch, remote tip, tag absence, and user changes. Commit only release files once, using the repository's commit convention. Create a new `v<package-version>` tag on that commit. Do not amend an existing commit or replace an existing tag.
2. Push the branch and new tag together using `git push --atomic origin HEAD:refs/heads/main refs/tags/v<package-version>` only if `main` is the expected target and the push is a fast-forward. A rejected push or unavailable atomic push is a blocker; never force or silently switch strategies. An explicit user request to only prepare or commit overrides this step.
3. Check the GitHub Actions run for that tag and follow it to completion. Verify the SDK and MCP versions are publicly visible on npm and the MCP Registry version is `active`. Report the workflow link, actual result, versions, commit, and tag. If the run fails, cannot be observed, requires authentication or staged-package approval, or times out, report the exact blocker and partial publication state; do not claim success or repeatedly publish. Do not push additional fixes without authorization for those changes.
