# Development and releases

Runtime source lives in extension/. The extension uses no bundler or remote scripts.

1. Keep shared.js/page-core.js and project.js/project-core.js identical. Chrome content scripts in the two worlds use distinct filenames.
2. Update translations and documentation when behavior changes. User-entered labels must not be translated.
3. Run node --test extension/tests/*.test.cjs and python scripts/build.py.
4. For bridge, manifest or UI integration changes, load the actual MV3 extension in a clean Chromium profile and verify both worlds, popup, dashboard and game overlay. Use synthetic account data.
5. Check staged files for HAR files, session material, real account exports and personal wallet defaults. They must not enter this repository or release assets.
6. Bump extension/manifest.json for a release, update CHANGELOG.md, commit and push the tested source.
7. Create a versioned GitHub release and attach dist/crh-monitor-vVERSION.zip using gh release create with --notes-file. The build reads VERSION from the manifest.

Install ZIPs contain only runtime assets, the two user guides and LICENSE. Promotional MP4/ZIP assets may be attached separately. Keep the public releases/latest link stable. Unpacked installs update manually; explain replacing files in the same installed folder and reloading game tabs.

Financial changes need tests for units, double counting, unknown data, receipts, account separation and stale observations. Leaderboard snapshots must retain their completeness and source timestamps. A CRH valuation or hashrate-based hardware estimate must never be labeled as exact historical cash investment.
