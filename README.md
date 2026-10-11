# CRH Monitor 1.9.0

An independent, read-only browser extension for **Computers RH**: income, payback, wallet accounting, economy history and mini-farm planning.

**Chrome / Edge · English / Русский · Manifest V3 · Local storage**

[Download the latest release](https://github.com/enillyddjens/crh-monitor/releases/latest) · [Русская инструкция](README.ru.md)

## Install or update

1. Download **crh-monitor-v1.9.0.zip** from GitHub Releases and extract it.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted **crh-monitor** folder containing `manifest.json`.
4. Pin the extension and reload the game tab.
5. Select your wallet in **⚙ → Wallet and calculation settings**, or connect it in the game. A fresh install adopts the first observed game wallet; an existing selection is preserved.

For an update, replace the files in the existing unpacked folder, press **Reload** on the extension card, then reload the game tab. Keep the same extension folder / ID to preserve local history. Updates pushed to GitHub do not automatically replace an unpacked installation.

Switch **EN / RU** at the top of the popup, dashboard or overlay. The language is saved across all three surfaces. First-install language follows the browser. The − button minimizes the game overlay.

## Income, payback and accounting

- **Payback and ROI** stay at the top, separately for external cash used to buy CRH and for external cash + reward-funded reinvestment. Cash recovery counts actual CRH sales net of recorded gas. Wallet assets are not recovered cash.
- **Daily net income** uses observed rewards and the current game quote, minus claim tax, selling-fee assumption, energy, Care and configured gas. Energy and Care are shown separately. This is a current-rate estimate, not tomorrow's guaranteed payout.
- **Your CRH value** includes wallet tokens and confirmed unclaimed Rewards after applicable tax. Confirmed Social Pot rewards are tax-free. Already received payouts are never taxed again; stale/pending balances are marked.
- **Project PnL** and operation details include buys, sales, gas, game payments and historical claim prices. A missing past price stays unknown; today's quote is not substituted into history.
- An unpaid shop or Workshop quote is metadata, not a spending entry. Expenses require a confirmed on-chain payment.

Current mining-claim tiers are 5 / 10 / 20 / 40 / 80% according to earlier claims in the rolling 24h window, with a minimum 2h pause. The observed game rate takes priority. Unknown current tax uses a marked 80% maximum for existing Rewards. Daily income assumes manual claims every 25h at 5%; cadence and tax can be changed in settings.

Care covers fans, paste and parts together. A server rate takes priority. Without it, the extension marks **5% as an estimate from the announced 50% price reduction**; Docs still say 10%. Manual Care replaces the automatic estimate. The $0.05 minimum assumes a grouped payment every 6h. The current Care-all quote is shown separately from recurring costs.

The game requires a qualifying 12h average holding of 25,000 CRH including stake. The extension keeps a conservative wallet floor, reduced by observed stake; spot balance does not prove eligibility or qualifying token origin. Holding is an asset, not a recurring expense. Average historical purchase price is an illustrative acquisition estimate for that reserve; game costs use the current quote.

## Development: manual mini-farms

**Development** compares custom builds using HD 5770 ($9) / GTZ 560 Ti ($30), Hall, full plot/power prerequisite bundles, GPU + PSU replacement and GPU Workshop. Recipes follow the shop order. It shows cost, island hash gain, marginal net income, payback and the result over **3 / 5 / 10 days relative to retaining CRH**, including a no-purchase option. Long routes and alternatives are collapsed.

Funding uses the selected wallet and accrued rewards only. The model keeps the holding reserve and a day of operating costs, uses prepaid energy before 12h refills, respects claim timing and reconciles wallet/claim balances. Inventory parts are consumed once; removed GPUs and PSUs remain available with zero resale proceeds. Future Social Pot wins and NFT value are excluded. Native gas remains a separate funding requirement.

Workshop boosts only the GPU contribution. Matching, the Hall cap and construction hash record still use healthy base hash. Routes use Steady; comparisons show Gamble/Wild probabilities with level floors/caps. Observed levels are preserved. Unknown boosted levels keep the observed boost in baseline income but receive no Workshop recommendation. Sequential timing is conservative; parallel manual upgrades may be faster.

The four scenarios are assumptions: current conditions; pool drainage without inflows; recovery with competing-hash growth; and ±50% price swings. Today's budget remains fixed until the observed day reset; your modeled purchases replenish the next-day pool using the 60/20/20 split. Approximate fallback efficiency and the catalog date are shown. The verified starter subset dated 11 Oct 2026 is used until live shop metadata is available. Thin margins are flagged, and the 5% Care fallback includes a same-route 10% sensitivity check. Search is bounded: **best route found** does not prove a global optimum.

Press **Calculate** for a frozen result. Live updates never regenerate or erase the route. Each wallet's forecast is saved and exported; a failed recalculation preserves the previous successful result. Old planner forecasts remain in storage/exports, but the legacy model is not shown as a current recommendation.

## Analytics and leaderboards

Economy observations are recorded approximately every 10 minutes, up to 30 days. **Top-100 hash and Top-1500 spenders** are captured hourly while the game is open. Spender scans stop at 75 pages, use pauses and stop on failure. A partial scan never becomes a complete archive or overwrites the last complete board.

Rank **#1111** has an independent 30-day spent-CRH history. Missing data means unknown, not zero. Rank does not guarantee NFT eligibility. Detailed boards are retained up to 14 days within a 10 MB cap. Tooltips distinguish observed USD spending, spent CRH valued now and rough ready-PC equivalents; none is fabricated external investment.

Analytics includes personal-share dilution, ranked-island growth and activity spikes from recorded observations. Ranked islands are not unique users; missing history is not reconstructed. Exports contain both public project observations and selected-account history.

## Privacy and limitations

The extension reads the game, public RPC and allowlisted price feeds. It never signs transactions, purchases, claims, refills, repairs, overclocks, upgrades or submits social posts. Session headers stay in the page bridge; signatures, private keys, auth tokens and HAR files are not stored in exports or shipped in releases. Account exports can contain wallet addresses and financial history: review them before sharing.

Balances require matching accounts and snapshots. Unavailable quotes, uncertain Care, market depth, slippage, eligibility, unannounced rule changes and future pool inflows can alter results. Estimates are not promises of ROI.

## Development

Run `node --test extension/tests/*.test.cjs`, then `python scripts/build.py`. The build includes runtime assets and documentation only, validates the two MAIN/isolated-world mirrors and excludes tests, HARs, snapshots and private data. Browser QA uses synthetic fixtures.

MIT license. Independent community tool; not affiliated with the game team.
