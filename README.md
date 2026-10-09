# CRH Monitor 1.3.0

An independent, read-only browser extension for **Computers RH**. Track your CRH position and follow the game's economy without keeping a spreadsheet.

**Chrome / Edge · English / Русский · Manifest V3 · Local storage**

[Download the latest release](https://github.com/enillyddjens/crh-monitor/releases/latest) · [Русская инструкция](README.ru.md)

![CRH Monitor overview with clearly marked demo values](https://github.com/enillyddjens/crh-monitor/raw/main/docs/media/01-overview.png)

## Install

1. Download **crh-monitor-v1.3.0.zip** from GitHub Releases and extract it.
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
- **Project:** economy charts, hourly snapshots of both top-100 leaderboards, change events and player tooltips.

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

Game state is observed or read every 30–60 seconds while a valid game tab is available. Wallet balances/history refresh about once per minute while the browser is running. Project collection depends on that game session. Closing the game stops fresh game observations; closing the browser or sleeping the computer stops collection. Background-tab throttling can delay sampling.

After two minutes without fresh game data, claimable rewards are excluded from PnL and payback is paused. Prices and cached snapshots carry freshness indicators. Failed API/RPC reads preserve recorded data and show an unavailable-source status.

Settings, account observations, transactions, corrections and public project snapshots stay in **this browser profile**. No analytics or developer backend is used. The extension does not read a seed phrase, connect to `window.ethereum`, sign transactions or initiate buys, claims or approvals. Session headers remain inside the game-page bridge for its GET requests; they are never saved or exported.

Host access is limited to the game, Robinhood's public RPC and Coinbase's public candle API. The RPC receives public wallet queries. Coinbase receives market/time requests without your wallet address. Browser `storage`, `alarms` and `unlimitedStorage` permissions support local collection; retention is still bounded as described above.

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
