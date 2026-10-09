# Changelog

## 1.6.1 — 2026-10-09

- Require known pool release rules for a named scenario; incomplete snapshots return a fresh-data message instead of silently using legacy manual percentages.


## 1.6.0 — 2026-10-09

- Replace manual scenario inputs with four project paths and an all-scenario comparison, with 3/5/7/10-day horizons and Russian/English labels.
- Model delayed 60% purchase replenishment, pool depletion, announced server release changes and your own payments separately; use top-100 token-spend growth only as a lower bound on historical inflows.
- Keep the public-launch timestamp fixed; include interior price peaks in reinvestment search bounds and normalize paths after launch.
- Add an explicitly conditional collapse cashout route without new equipment; no real purchases, sales or signatures are executed.
- Preserve numbered RAM/fan slots and account for installed RAM/fans when older snapshots omit their slot IDs, while excluding inactive sealed-PC towers.
- Add regression tests for pool conservation, no vault double count, launch timing, self-funded payments, exit gas and maintenance coverage.


## 1.5.0

- Reinvestment-only development planner: wallet balance (optional), claimable rewards and future mining fund sequential steps without new deposits.
- CRH payment-time conservation, native ETH gas bounds, current game-day payout calibration and scenario-based price/hash/reward changes.
- Builder-queue completion, prospective queue gates, inventory reuse and operating reserves with 12-hour energy refills and average care.
- Choose ending CRH value or hashrate; see next steps, accumulation/payment/completion times, post-payment balances and daily projections.
- Fresh reconciled funding guards, no-earning-without-energy checks and explicit mining interruption reporting.
- Five-minute recalculation on a visible reinvestment tab, per-wallet preferences and forecast export with source times and assumptions.
- Unknown installed components no longer silently reduce care estimates; overview care notices stay with the overview.
- RU/EN documentation and regression coverage; deterministic hourly-archive test clock.


## 1.4.0

- Separate Initial investment and Investment + reinvestment amounts, including reward-funded electricity and care.
- Claim-price valuations, payment-time values and reinvestment FX with proportional allocation of mixed balances; original cash PnL unchanged.
- Automatic confirmed game prices and a validated DEX Screener CRH quote archive, explicit sources and bounded historical recovery.
- Account-position history, dilution, ranked-island growth, new top-100 entries and uninterrupted activity-spike detection in Analytics.
- Read-only Budget planner using observed recipes, inventory reuse, replacements, construction gates, bonuses, paid builder queue and full-horizon operating reserves.
- Price, hash and reward-budget scenarios; best-found plans and optional no-purchase decisions with clear search limits.
- Expanded RU/EN guides, account exports and financial/DEX/planner regression tests.

## 1.3.0

- English/Russian language selector with immediate updates and saved preferences.
- Neutral first-install wallet selection and preservation of existing settings.
- Project economy observations, charts and significant-change events.
- Hourly top-100 Hashrate and Top Spenders snapshots, compact local archive and historical selection.
- Player hover/focus details in the extension and the game's native leaderboard.
- Separate project JSON export, alongside account export.
- Explicit distinction between CRH-spend valuation, recorded USD game spending and ready-PC equivalents.
- Read-only operation; session headers remain in the game bridge.
- Public installation guides, demo images and English promotion thread.

## 1.2.1

- Settings navigation through the background worker instead of an unavailable content-script API.
- A clear reload prompt after extension context invalidation.

## 1.2.0

- Transaction-based PnL and order quote/confirmation metadata.
- Current build and full build-queue timing shown separately.
- Server-provided power levels and expanded account export.
