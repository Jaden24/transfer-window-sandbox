# Transfer Window Sandbox

**An AI agent runs your football transfer window. The page refuses every deal that breaks the rules.**

Built for [The WebMCP Challenge](https://webmcp.devpost.com/).

**▶ Live demo: https://transfer-window-sandbox.vercel.app/**

---

## Where WebMCP is used

Tools are registered on mount in [`src/App.tsx`](src/App.tsx), through
[`src/webmcp/adapter.ts`](src/webmcp/adapter.ts). Each of the 14 is the standard shape:

```js
document.modelContext.registerTool({
  name: 'propose_signing',
  description: 'Add a signing to the transfer plan. The page REFUSES the move if it ' +
               'would breach PSR or the squad-registration limits, and tells you by ' +
               'exactly how much.',
  inputSchema: {
    type: 'object',
    properties: {
      player_id:       { type: 'string' },
      fee_millions:    { type: 'number' },
      contract_years:  { type: 'number' },
      weekly_wage_gbp: { type: 'number' },
    },
    required: ['player_id'],
  },
  execute: async (input) => { /* validates against rules.ts, refuses if illegal */ },
});
```

The real call sits behind a small feature detector rather than being hard-coded, because
the API is an origin trial and is still moving — the W3C proposal exposes
`navigator.modelContext` while the Chrome guides show `document.modelContext`, and
registration is either per-tool `registerTool` or a bulk `provideContext`. The adapter
uses whichever the browser actually provides:

```ts
// src/webmcp/adapter.ts
const ctx = navigator.modelContext ?? document.modelContext;

if (typeof ctx.registerTool === 'function') {
  for (const tool of tools) ctx.registerTool(tool);      // per-tool
} else if (typeof ctx.provideContext === 'function') {
  ctx.provideContext({ tools });                          // bulk
}
```

One file to change when the spec settles. The 14 tool definitions themselves live in
[`src/webmcp/tools.ts`](src/webmcp/tools.ts).

---

## The problem, for people who don't follow football

English football clubs are not allowed to lose money freely. Under the Premier League's
**Profitability and Sustainability Rules**, a club may lose at most **£105m (about $133m) across three
seasons**. Break it and you don't get a fine — you lose league points.

This is not hypothetical:

- **Everton** were docked **10 points** (reduced to 6 on appeal) for exceeding the limit
  by £16.6m (~$21m), then [docked 2 more the same season for a second breach](https://www.skysports.com/football/news/11671/13107642/everton-deducted-two-points-for-breaching-premier-league-profitability-and-sustainability-rules-for-second-time).
- **Nottingham Forest** lost [**4 points** for going £34.5m (~$44m) over their threshold](https://www.espn.com/soccer/story/_/id/39758929/nottingham-forest-deducted-four-points-financial-rules-breach).

Points decide relegation, and relegation is estimated to cost a club around
[**£100m — roughly $127m**](https://sports.yahoo.com/articles/much-does-relegation-cost-premier-170002060.html).
So the arithmetic behind a transfer is worth roughly as much as the transfer.

### And the arithmetic is genuinely counterintuitive

**A transfer fee is not a cost when you pay it.** It is spread evenly across the
contract — capped at five years since the Premier League
[voted the limit in](https://www.espn.com/soccer/story/_/id/39096988/premier-league-clubs-vote-five-year-player-contract-limit)
to stop clubs signing players to eight-year deals to shrink the annual charge.

> A £110m ($140m) signing on a five-year contract is a **£22m ($28m)** cost this
> season — not £110m.

**A sale, by contrast, books its profit immediately** — the fee minus whatever the
player is still worth on the books. A player who came through your own academy has a
book value of **zero**, so their entire fee is pure profit. This is why clubs sell their
own young players every June.

### The scale

Premier League clubs spent a record [**£3.48bn — about $4.4bn** in the 2026 summer window](https://cryptobriefing.com/premier-league-2026-summer-transfer-window-records/),
recouping £2.17bn ($2.8bn) in sales. All of it under a £105m loss ceiling, all of it racing a
**30 June accounting deadline** that [Sky Sports calls football's unofficial transfer
deadline day](https://www.skysports.com/football/news/11095/13144913/june-30-the-unofficial-transfer-deadline-day-worrying-premier-league-clubs-over-profit-and-sustainability-rules) —
and increasingly settled by **chief financial officers** rather than scouts, through
two-way "mirror" deals engineered to book profit now and spread cost later.

That is the job this sandbox hands to an AI agent.

*Dollar figures throughout are approximate, converted at about $1.27 to the pound. The
app itself has a **£ → $** toggle in the header if you would rather read it that way.*

---

## What happens when you try

Ask the agent to sign a £110m ($140m) striker with £20.3m ($26m) of headroom. It does not apologise
and comply. **The page refuses**, and hands back the arithmetic:

```json
{
  "refused": true,
  "reason": "Signing Victor Osimhen for £110m would break the rules.",
  "detail": {
    "violations": [{
      "code": "PSR_BREACH",
      "message": "PSR breach. Three-year aggregate is -£117m against a -£105m limit — over by £12.1m."
    }],
    "annual_amortisation": { "display": "£22.0m" },
    "annual_wage": { "display": "£10.4m" },
    "hint": "Free up room first — call rank_sale_candidates to see which sale helps most."
  }
}
```

---

## The idea

Most agent demos put the model in charge and hope it behaves.

**Here the page owns the rulebook, and the agent is only allowed to operate it.**

Every rule above lives in [`src/engine/rules.ts`](src/engine/rules.ts) as pure functions
with a test suite. The tools are thin wrappers over it. The model never does the
arithmetic — so the model cannot bluff, and cannot talk its way past a limit.

## Why this needs WebMCP, not a normal MCP server

**The page is the referee, in the same process as the UI.** A tool call and a button
click run the identical mutation in [`src/engine/store.ts`](src/engine/store.ts). The
agent has no privileged back door, and you watch the board change under its hands.

**Refusal is a first-class result.** `propose_signing` returns `isError` with the
violated rule, the amounts, and a next step. The agent is not asked to be well-behaved;
it is structurally unable to proceed.

**The final action has no agent-reachable path.** `submit_window` does not return when
called — it raises a confirmation and **suspends**. The agent sits blocked inside the
tool call until a human presses a button. An agent working against a REST API could
always call `POST /submit`. Here there is no server, so there is nothing to call.

---

## The tools

14 tools, three tiers, one gate — [`src/webmcp/tools.ts`](src/webmcp/tools.ts).

| Tier | Tools |
|---|---|
| **Read-only** | `get_club_state` · `list_squad` · `search_players` · `get_player` · `compute_psr_position` · `check_squad_compliance` · `evaluate_transfer` · `rank_sale_candidates` |
| **Reversible** | `propose_signing` · `propose_sale` · `remove_from_plan` · `get_plan` · `clear_plan` |
| **Consequential** | `submit_window` |

**`rank_sale_candidates`** is the one to look at. It ranks the squad by the real PSR
swing from selling each player, and the answer is regularly counterintuitive — an
expensive recent signing can help more than an academy graduate, because you shed their
amortisation and wages as well as booking the fee. No agent can reason its way there.
It has to ask.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rules engine tests
```

**With an agent:** open the live URL in the ChatGPT desktop app's built-in browser,
which discovers WebMCP site tools natively, and just talk to it.

**In Chrome:** enable `chrome://flags/#enable-webmcp-testing`, then
DevTools → Application → WebMCP lists all 14 tools and lets you call them.

**With no agent at all:** the app is fully usable by hand, and the **WebMCP tools**
panel invokes every tool through the same code path.

## Deploying

Static output — no backend, no auth, no keys.

```bash
npm run build && vercel --prod
```

To enable WebMCP for visitors who haven't set a Chrome flag, register the deployed
origin at [developer.chrome.com/origintrials](https://developer.chrome.com/origintrials)
and paste the token into the commented `<meta>` tag in [`index.html`](index.html).

---

## Against the judging criteria

**WebMCP leverage.** 14 tools in a deliberate three-tier taxonomy, refusal as a designed
result rather than an error path, structured JSON responses per Chrome's tool-design
guidance, and a human gate that genuinely suspends the tool call — the documented
pattern, not an approximation.

**Execution.** No backend, no auth, no API keys. Pure-function rules engine with tests,
strict TypeScript, and full usability when no agent is attached.

**Potential impact.** The football framing is the hook; the argument generalises. Any
domain with a real rulebook — tax, benefits eligibility, medical billing, export
control — has the same problem: an agent that sounds authoritative about arithmetic it
cannot actually do. Putting the rulebook in the page and forcing the agent through it
is a reusable answer.

**Creativity & ambition.** Sport is absent from the WebMCP ecosystem. And rather than
bolting guardrails onto a capable agent, this removes the agent's ability to be wrong
about the things that matter — and shows you the refusal.

---

## Future work

**Roles as tool tiers.** The gate currently means *any* human. In a real club it would
mean a specific one — a scout gets read-only tools, an analyst can build a plan, and
only a sporting director's click resolves `submit_window`. Auth wouldn't sit beside the
tool surface; it would be the same taxonomy, per user.

**A market that moves.** Valuations shift daily and news breaks. Live pricing would
sharpen the argument rather than complicate it: an agent that *remembers* a valuation is
already wrong, and asking the page at the moment of acting is the only way to be right.

---

## Data and honesty

Club and player names are real, because the constraints only mean something if you
recognise them. **Every financial figure is invented** — fees, wages, contract lengths,
revenues, prior-season losses — and tuned so each club sits in a distinct, legible PSR
position. They are not club accounts and should not be cited as such.

**The rules are real and public.** That is the part worth learning, and the part the
page actually enforces.

Nothing here is financial advice, and no transfer is real.

## Licence

MIT — see [LICENSE](LICENSE).
