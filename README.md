# CRH Monitor 1.5.0

An independent, read-only browser extension for **Computers RH**. Track your CRH position and follow the game's economy without keeping a spreadsheet.

**Chrome / Edge · English / Русский · Manifest V3 · Local storage**

[Download the latest release](https://github.com/enillyddjens/crh-monitor/releases/latest) · [Русская инструкция](README.ru.md)

![CRH Monitor overview with clearly marked demo values](https://github.com/enillyddjens/crh-monitor/raw/main/docs/media/01-overview.png)

## Install

1. Download **crh-monitor-v1.5.0.zip** from GitHub Releases and extract it.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted **crh-monitor** folder containing `manifest.json`.
4. Pin the extension icon and reload your [Computers RH game tab](https://www.computersrh.xyz/play/island).
5. Choose your wallet in **⚙ → Wallet and calculation settings**, or connect it in the game. On a fresh install, the first observed game account becomes the selected wallet. An existing selection is preserved.

Switch **EN / RU** at the top of any panel. The selection is saved and synchronized across the popup, dashboard and game overlay. The first-install language follows the browser language; existing Russian settings keep Russian until you switch.

Click the icon for the popup, ⚙ for the full dashboard, or use the overlay at the bottom right of the game. The − button minimizes the overlay.

## What you see

- **Project PnL:** purchases, sales, gas, rewards and the current value of remaining CRH.
- **Your CRH value:** wallet balance plus fresh claimable rewards, at the game's quote.
- **Daily net income:** current mining rate minus electricity and your configured costs.
- **Game payback:** the cash still to recover divided by current daily net income.
- **Transactions:** CRH buys, game payments, reward claims, execution prices and recorded order quotes.
- **Initial investment / Investment + reinvestment:** separate external funding from rewards spent in the game.
- **Analytics / Budget:** dilution, project activity and scenario comparisons.
- **Analytics archive:** economy charts, hourly snapshots of both top-100 leaderboards, change events and player tooltips.

Detailed pool, hash, power, energy and build-queue information stays in expandable sections. Choose your selling fee, PC-care reserve and gas budget in settings. The default **3% selling fee is an assumption**, not a detected market fee.

## Project dynamics and leaderboards

Keep the game open with a valid session. The extension makes read-only GET requests for the first five pages of **Hashrate** and **Top Spenders**, up to 100 islands per board, **once per hour**. The initial snapshot starts after a valid game-state read. Fewer ranked islands produce a smaller complete snapshot.

Only a complete, internally consistent, non-stale read is archived. Searches, later pages, failed requests and server-marked stale responses do not become full snapshots. The game may refresh its own ranking on a different schedule; the recorded server timestamp is shown.

The **Project** tab provides:

- 24-hour, 7-day and 30-day views of total hashrate, CRH price, daily reward budget, pool and vault observations.
- Historical leaderboard selection, ranked-island counts and hover/focus details for each player.
- Events for reward-budget or economy-rule changes and large observed hash/price moves.
- A separate **Export project history** JSON containing public project observations.

Economic observations are sampled about **every 10 minutes**, with immediate additional points for recorded rule/budget changes. Economy history retains up to **30 days**; hourly leaderboards retain up to **14 days**, subject to a **3.5 MB board/profile cap**. Oldest snapshots are removed as needed. Compact snapshot rows share public profile records. The archive is shared across your monitored wallets, so switching accounts does not duplicate project observations.

The graph uses recorded points. Gaps longer than 30 minutes are left disconnected; missing periods are not reconstructed. Percentage changes use the observed baseline and say when the history is shorter than the selected window. This is local collection starting when you install the extension, not an archive of the game's past.

### What a player's dollar estimate means

Hover a player in the extension or the game's own leaderboard. The tooltip shows available hash, CRH spending and a reference estimate based on observed ready-PC catalog prices.

The current API normally provides **spent_x, in CRH**, rather than historical USD spending. Multiplying this by a current or captured token price is a **valuation of the spent tokens**, not proof of dollars deposited. If an explicit `spent_usd_micro` value is supplied, it is labeled **in-game spending**, which still differs from the player's original cash purchase of CRH.

The **ready-PC equivalent** is an illustrative range: `hash × catalog $/H/s`, allowing for an assumed 0–84% island bonus and up to 50% speed loss. It excludes construction, energy, care and idle inventory. Custom builds can be cheaper than ready PCs. It is neither a guaranteed lower/upper bound on real spending nor a recovered investment total. No estimate appears until the extension observes a PC catalog response.

## Investment, reinvestment and claim prices

**Initial investment** is the historical USD cost of external CRH purchases, including top-ups. **Investment + reinvestment** adds the reward-funded share of every confirmed game payment: hardware, construction, electricity, care and other shop purchases. It does not add the same purchased tokens a second time. A mixed balance consumes purchased and reward tokens proportionally, using a moving average; token provenance is an accounting estimate.

The reinvestment details show rewards at claim prices, their value when spent and the difference. **Result before reinvestment** is Project PnL plus rewards subsequently spent in the game. It is a result before those expenses, not withdrawable money or hardware resale value. Project PnL itself is unchanged.

Game execution prices are automatic: confirmed USD order value divided by CRH paid. Claim market prices are estimated from the nearest saved game quote, a confirmed game payment or a validated DEX Screener CRH quote within **60 seconds** of the claim. The source and time offset are shown. The extension records DEX quotes about every 30 seconds, selecting the most liquid eligible Robinhood pool with the exact CRH base-token address; quotes can lag market activity. DEX quotes are retained for up to 30 days locally. Today's price is never used for a past claim. Missing historical prices leave the FX calculation unavailable; they do not prevent payment-based reinvest totals. Manual corrections are optional.

The public [DEX Screener API](https://docs.dexscreener.com/api/reference) provides current quotes, not a historical-candle endpoint. Old claims are recovered only where recorded contemporaneous data exists. Account exports now include investment summaries, price observations and account-position history.

## Analytics and budget planner

**Analytics** adds personal-share history, ranked-island growth, new entries in the top 100 and detected hash-activity spikes. **Dilution at unchanged personal hash** isolates the effect of project growth from your own upgrades. A negative dilution means the project shrank and your hypothetical share increased. Ranked islands are not unique humans; entering the top 100 does not prove a new account. Spikes require adjacent observations no more than 30 minutes apart, so collection gaps do not create false bursts. Account-position observations are sampled every 10 minutes and retained up to 30 days for each wallet.

In **Budget**, enter an available USD budget and a 1–30 day horizon. The planner compares ready PCs, the same verified recipes assembled from parts, inventory reuse, replacements, on/off decisions and builder upgrades. It uses observed server prices, timing, Hall/plot prerequisites, hash-record pricing, shared grid reservation and matching bonuses. It reserves energy, care and estimated gas for the full horizon; in Fixed budget mode, projected rewards do not finance further actions. Included card energy is credited only against electricity. Planned purchases start after the current paid builder queue.

The displayed result is **incremental profit/loss versus keeping the current PCs**, after new hardware and construction costs. Care assumes paste at 80% lifetime, cleaning every 48 hours and repairs every 14 days, with 92.5% of healthy speed for all forecast PCs; current component age and exact service dates are not modeled. Selling fees come from settings; gas is estimated from known game payments and claims. The scenario controls set price change, other-island hash growth and daily reward-budget change. Default 10% daily hash growth is an assumption; the default reward decline uses the observed release rate without replenishments. Future rule changes, outside pool replenishments, referral bonuses, market depth and slippage are not predicted.

The bounded search compares up to 18 actions with 60 candidates retained at each stage. It returns the best found plans and can recommend no new purchase. It is **not a proven global optimum**; it does not search arbitrary component swaps within a recipe. Incomplete/stale catalog, progression or care data blocks a recommendation. The catalog is refreshed with the hourly game reads. The main recommendation stays visible; alternatives and model details are expandable. The planner never initiates purchases or wallet actions.

### Reinvestment only: no new deposits

In **Budget → Mode → Reinvestment only**, choose a 1–30 day horizon. Balances are read automatically: claimable game rewards plus, optionally, the existing CRH wallet balance. The wallet may include tokens purchased earlier; unchecking it starts with unclaimed rewards only. Legacy test credits are never added. A fresh, wallet-scoped RPC balance and reconciled transaction history prevent double-counting claims. Existing ETH must fund estimated native gas; CRH is never assumed to pay ETH gas automatically.

The simulator accumulates CRH, claims when payment needs it, then pays each development step at its scenario-time token price. New PCs change subsequent reward shares. Current paid builder jobs finish on their recorded timers, and new jobs can be queued while other development continues. Recipe assembly, component reuse, card limits, grid reservation, healthy-hash gates, hash-record prices and matching bonuses remain enforced.

Choose **CRH balance** to favor the remaining liquid value at the end, or **Hashrate** to favor expansion. The plan gives the next step, modeled waiting/payment/completion times, full parts recipes, CRH balances after each payment and daily balance projections. Electricity is refilled in actual 12-hour lots; care uses average daily charges. The default 24-hour operating reserve can be adjusted from 12 to 72 hours. Native gas uses existing ETH, with a 25% buffer over recorded average fees. Care timing, wear and gas are estimates, not exact future bills.

Today's confirmed server payout calibrates the simulation; the reward-budget scenario starts at the recorded game-day reset. Prices and other islands' hash follow your scenario. Game spending does not incur a modeled selling fee; a hypothetical ending cash-value comparison uses the selling-fee setting. The calculation conserves tokens, cannot spend future income before it is earned, and does not inject new money. It can recommend waiting or retaining rewards. If existing funds/energy cannot keep mining, the interruption is displayed.

Separate mixed and expansion searches each keep up to 24 development actions and 20 candidates, with 36,000 examined variants in total and roughly 30-minute waiting steps. It returns the best plans found, not a guaranteed global optimum. Arbitrary individual component combinations, new referrals, unannounced rule changes and slippage are not forecast. Pool replenishments and announced release-rate changes follow the selected scenario. Recalculate using Update plan as actual data changes. Background observations never automatically replace a successful plan. Account exports include the last forecast with its snapshot time and assumptions. No purchase, claim, approval or transfer is executed.

## PnL and payback

```text
Project PnL = wallet CRH value + fresh claimable reward value
            + CRH sale proceeds / valued withdrawals
            − CRH purchase cost − recorded transaction gas
```

PCs and upgrades already reduce the token balance; their USD amounts are not subtracted a second time. Hardware resale value is excluded. PnL includes unrealized token value and is not the same as cash withdrawn. Valued transfers to another wallet count as assets removed from this account, not bank proceeds.

Rewards have zero acquisition cost. Sales and game payments use the average cost basis of CRH held at the time. For example, buying 100 CRH for $100 and spending 30 leaves 70 CRH: at $1 the result is −$30 before gas; at $2 the result is +$40. The game's $60 payment and its $30 token gain are details of that same result.

```text
Daily net income = personal server reward rate × 24 × CRH price × (1 − selling fee)
                 − electricity − configured PC care − configured gas
Game payback     = unrecovered investment basis / daily net income
```

The personal server rate is used without deducting the referral share twice. A blank care field means care is excluded and is flagged. The automatic payback basis uses cumulative in-game USD spending; you can enter another basis and cash already recovered. Held CRH is not automatically treated as recovered cash. These settings do not replace transaction-based PnL.

Payback assumes the current rate continues. It is not a forecast or a promised return. Non-positive income has no current-rate payback. Price, pool, competition and costs can change. Market depth and slippage are not calculated.

## Transaction sources and missing data

The extension reads CRH Transfer events, successful receipts and recognized transaction details from **Robinhood Chain, chain ID 4663**. Scanning resumes from a saved cursor, waits for confirmations and rechecks recent blocks.

- Pons swaps use the verified trade amount, rather than `tx.value` that may include a refund.
- USDG swaps use the monitored wallet's net token flow, assuming USDG = $1. WETH flows are recognized where visible in that wallet.
- Game payments to the known shop use the confirmed order USD value and sum the pool/burn/treasury token split once.
- Known reward-vault payouts are rewards, not purchases.
- ETH/WETH and gas are valued using Coinbase's opening ETH/USD candle for the transaction's minute. This is an approximation.

Order names and quote prices are recorded while the game is open. A quote alone does not create a PnL expense. A successful payment does. Old order names may be recovered with a normal order-status GET; old quote prices are not guessed.

Use **Transactions → Details → Edit details** to classify unclear transfers or enter a missing cost. On-chain game USD values are protected from accidental changes. Custom labels remain exactly as entered when you change the interface language.

A partial scan, unknown acquisition cost or balance mismatch leaves total PnL unavailable rather than fabricating a result. Missing gas is flagged separately. Approvals and unrelated transactions without a CRH Transfer are not automatically included. Newly claimed rewards are protected against being counted twice while the game snapshot catches up.

## Freshness and privacy

Game state is observed or read about every 15 seconds while a visible, valid game tab is available. Wallet balances and DEX quotes refresh about every 30 seconds; routine ledger scans stay at two minutes. Observed claims or spending trigger a wallet/history refresh. Project collection depends on that game session. Closing the game stops fresh game observations; closing the browser or sleeping the computer stops collection. Background-tab throttling can delay sampling.

Last confirmed unclaimed Rewards remain in CRH value and PnL when the game snapshot becomes stale, with a snapshot warning; they are not extrapolated into future earnings. Combined value waits for synchronization if wallet and ledger disagree or a newer payout invalidates the Rewards snapshot. After two minutes without fresh game data, payback and new plan calculations remain paused. Prices and cached snapshots carry freshness indicators. Failed API/RPC reads preserve recorded data and show an unavailable-source status.

Settings, account observations, transactions, corrections and public project snapshots stay in **this browser profile**. No analytics or developer backend is used. The extension does not read a seed phrase, connect to `window.ethereum`, sign transactions or initiate buys, claims or approvals. Session headers remain inside the game-page bridge for its GET requests; they are never saved or exported.

Host access is limited to the game, Robinhood's public RPC, Coinbase's public candle API and DEX Screener's public quote API. DEX Screener receives the public CRH contract address, not your wallet. The RPC receives public wallet queries. Coinbase receives market/time requests without your wallet address. Browser `storage`, `alarms` and `unlimitedStorage` permissions support local collection; retention is still bounded as described above.

Account exports contain the selected wallet's public transactions and game data. Project exports contain public ranking names and observations. Treat your own exports as personal data. Release packages and promotional media contain no user HAR files, session material or real account histories. All financial examples in media are marked **DEMO DATA**.

## Update

1. Download the next release and replace the files in the **same installed crh-monitor folder**.
2. Click **↻** on its card at `chrome://extensions` / `edge://extensions`.
3. Reload all open game tabs. If new host access is requested, review the extension's declared hosts.

Do not remove the extension to update it: removal deletes its browser-local history. Language, wallet settings and recorded data survive an ordinary reload. This unpacked distribution does not auto-update from GitHub. Use **Watch → Custom → Releases** on the repository for release notifications.

## Development

The extension source is in `extension/`. No bundler or runtime dependencies are needed. With Node.js installed:

```sh
node --test extension/tests/*.test.cjs
```

`shared.js` / `page-core.js` and `project.js` / `project-core.js` are mirrored for isolated and main-world injection. Keep each pair identical. Check the actual MV3 extension in Chromium after integration changes, including the overlay and language switching.

Build the install ZIP with Python's standard library:

```sh
python scripts/build.py
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release process. Independent project; not affiliated with Computers RH or Robinhood.

## Four project scenarios (v1.6)

The planner replaces manual scenario percentages with four conditional paths: collapse (3 days), slow growth (5 days), public-launch hardware buying from existing CRH (7 days), and volatile hype (10 days). Choose one or compare all four. Horizons differ: ending values are not a ranking of scenario likelihood. Price paths are assumptions, independent of game spending, and their future peaks are unknown in real trading.

Daily rewards follow the server's pool release rule and announced rate changes. 60% of modeled purchases becomes eligible from the next game day. Your game payments are added separately. A top-100 token-spend increase supplies a lower bound on known historical inflows; unknown past replenishments are excluded. Vault balances and already earned claims are not counted as unearned reward pool. Spending per new hash and operating expenses use the observed shop mix and an assumed bonus. Ranked-island counts mean owners with PCs, not active miners.

The collapse route avoids new capital purchases, retains 12 hours of operating funds, estimates selling excess CRH every 12 hours and a full exit after 60 hours. Dollar proceeds are conditional on executing those sales; the model does not guarantee price or liquidity and assigns zero terminal value after collapse. Swap gas uses the observed average game-transaction fee plus a 25% buffer. Sales are never automatic. Normal scenarios retain mined CRH; end values are marked to the modeled price, not realized profit.

Public launch is anchored to October 9, 2026, 16:00 UTC. Recalculating after launch does not restart the launch shock. The bounded search and 30-minute mining integration remain approximate. Only exact observed ready-PC recipes are searched; arbitrary custom component combinations are not exhaustively optimized.


## Reading and updating a plan (v1.6.2)

Plans recalculate when **Update plan** is requested. Temporary transaction sync, a balance mismatch or stale observations retain the last successful plan with a warning. Open recipes and action details remain expanded during background observations. The last saved plan restores for the same wallet and options; it is historical and must be updated with fresh reconciled data before purchasing. Wallet/option changes do not reuse another calculation. All four scenarios use one frozen observation.

Slow growth is a favorable assumption, not a forecast: other hashrate rises 50% over five days and the ending token price rises 10%. It can produce much higher CRH value per H/s than hype with much faster competition growth. The trajectory shows ending daily income per 1 H/s before energy, care and gas. Different 3/5/7/10-day horizons and ending balances are not equal-period investment returns or realized PnL.

DEX quotes record every 30 seconds for claim valuation; this never triggers plan recalculation. UI clocks update every 10 seconds. Existing freshness and balance-reconciliation requirements remain mandatory for a new calculation.


## Inventory and route comparison (v1.6.3)

Replacing a GPU, PSU or complete PC never sells the removed hardware. It remains in inventory and has zero cash or terminal resale value in the plan. A subsequent parts build consumes matching inventory units once; newly purchased parts are charged at their full list price. Each step separates purchases, reused components and removed parts. A ready card is purchased in full and includes its card energy; buying parts does not include energy. Sealed boxes are purchased as cards; an already owned stored box can be reused.

Reinvestment now compares separate mixed-development and expansion-without-replacements searches on identical observations. An expansion chain no longer has to survive the general search to be compared. Each pass keeps 20 candidates for up to 24 steps and 18,000 variants (36,000 total). This still does not prove a global optimum or exhaustively search arbitrary GPUs/PSUs. Both old and new PCs use the same 92.5% average-wear speed assumption. Actual component ages, thermal-paste degradation, individual service dates, fan historical fees and exact batched service gas can change results. Existing model versions remain visible as historical plans with an upgrade warning. Grain and Pebble use their documented lower care fees; first-card access follows observed shop gates rather than a $25 minimum.

Reinvestment headlines and four-scenario comparisons show the same ending value after the estimated selling fee and gas that ranks plans. Gross CRH value remains in Cost details; hardware and operating payments already reduce token balances and are not subtracted again.
