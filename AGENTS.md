# Workflow Rules

- Never build the installer (`npm run dist`) unless the user explicitly says **"Create installer"**.
- Never push to the main repo (`jalalamanj1/murshid.git`) or the releases repo (`jalalamanj1/Murshid-Releases.git`) unless the user explicitly says **"push"**.

# Release Process

- To publish a new version, run `npm run release` (which bumps nothing — bump the version first). It builds once, uploads the exe + blockmap + latest.yml to `jalalamanj1/Murshid-Releases`, then **verifies** that the served `latest.yml` sha512 matches the served exe. It aborts on any mismatch.
- Never mix release artifacts (exe, blockmap, latest.yml) from different builds — each `electron-builder` run re-signs the exe with a fresh timestamp, so hashes differ between runs. Always upload all three from the same single build.
- Never use `electron-builder --publish` directly (it can create partial releases). Use `npm run release` instead.
