# Transfer Window Sandbox

**An AI agent runs your football transfer window. The page refuses every deal that breaks the rules.**

Built for [The WebMCP Challenge](https://webmcp.devpost.com/).

**▶ Live demo: https://transfer-window-sandbox.vercel.app/**

Open it in Chrome with `chrome://flags/#enable-webmcp-testing` enabled to attach an
agent, or use the built-in manual tool runner to exercise all 14 tools without one.

You manage a Premier League club through a transfer window, with an agent working
alongside you. It searches the market, models deals, explains trade-offs, and edits
the plan. What it cannot do is state a number it did not get from the page, spend
money the club does not have, register an illegal squad, or submit the window.

Ask it to sign a £110m striker with £20m of headroom and it does not apologise and
comply. The page refuses, and hands back the exact arithmetic:

```json
{
  "refused": true,
  "reason": "Signing Victor Osimhen for £110m would break the rules.",
  "detail": {
    "violations": [{
      "code": "PSR_BREACH",
      "message": "PSR breach. Three-year aggregate is -£117m against a -£105m limit — over by £12.1m.",
      "over_by": 12100000
    }],
    "annual_amortisation": { "gbp": 22000000, "display": "£22.0m" },
    "annual_wage": { "gbp": 10400000, "display": "£10.4m" },
    "hint": "Free up room first — call rank_sale_candidates to see which sale helps most."
  }
}
```

---

## The idea

Most agent demos put the model in charge and hope it behaves. This one inverts that.

**The page owns the rulebook. The agent is only allowed to operate it.**

Football finance is an unusually good place to prove the point, because the rules are
real, public, arithmetic-heavy, and genuinely counterintuitive:

- **PSR.** A club may lose at most **£105m across a rolling three-season window.**
- **Amortisation.** A transfer fee is capitalised and spread evenly across the
  contract, capped at five years. A £100m signing is a **£20m annual charge**, not a
  £100m one. Almost everybody — including language models — gets this wrong.
- **Profit on sale.** Selling books the profit *immediately*: fee minus the
  unamortised residual. An academy graduate carries a book value of zero, so their
  entire fee is pure profit. This is why clubs sell their own kids in June.
- **Squad registration.** 25 senior players, of whom at most 17 may be non-homegrown.
  Under-21s are exempt.

Every one of those is implemented in [`src/engine/rules.ts`](src/engine/rules.ts) and
covered by tests. The tools are thin wrappers over it. The model never does the
arithmetic, so the model cannot bluff.

---

## Why WebMCP specifically

This is not an MCP server that happens to render HTML. Three things make it belong
in the page:

**1. The page is the referee, in the same process as the UI.** A tool call and a
button click go through the identical mutation in
[`src/engine/store.ts`](src/engine/store.ts). The agent cannot reach a privileged
back door the human does not have, and the human watches the board change under the
agent's hands. There is one source of truth and both parties are bound by it.

**2. Refusal is a first-class result.** `propose_signing` returns `isError` with the
violated rule, the amounts, and a concrete next step. The agent is not asked to be
well-behaved; it is structurally unable to proceed. That is a property of putting the
guard where the state lives.

**3. The consequential action has no agent-reachable path.** `submit_window` is the
only tool that touches anything final, and all it can do is *raise a confirmation*.
Completing it requires a click on a button rendered by this page. An agent operating
over a REST API could always call `POST /submit`; here there is nothing to call.

---

## The tool surface

14 tools, three tiers, one gate — see [`src/webmcp/tools.ts`](src/webmcp/tools.ts).

| Tier | Tools |
|---|---|
| **Read-only** — free to call | `get_club_state` · `list_squad` · `search_players` · `get_player` · `compute_psr_position` · `check_squad_compliance` · `evaluate_transfer` · `rank_sale_candidates` |
| **Reversible** — edits the plan, always undoable | `propose_signing` · `propose_sale` · `remove_from_plan` · `get_plan` · `clear_plan` |
| **Consequential** — human hand required | `submit_window` |

Two worth calling out:

**`evaluate_transfer`** models a deal without committing it, so the agent can tell you
what something costs before you agree to it.

**`rank_sale_candidates`** ranks the whole squad by the actual PSR swing from selling
each player. The answer is regularly counterintuitive — a recent expensive signing can
help more than an academy graduate, because you shed their amortisation and wages as
well as booking the fee. No agent can reason its way to that ranking; it has to ask.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rules engine tests
npm run build
```

**With an agent:** open the deployed URL in a WebMCP-enabled browser (Chrome with the
[WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial), or the
ChatGPT browser). The header badge turns green and reports how many tools registered.

**Without one:** the app is fully usable by hand, and every tool can be invoked
manually from the **WebMCP tools** panel — the same code path an agent hits. Reviewers
without the origin trial enabled can still exercise the whole surface.

The API is still moving: the W3C proposal exposes `navigator.modelContext` while the
Chrome guides show `document.modelContext`, and registration is either `registerTool`
or a bulk `provideContext`. [`src/webmcp/adapter.ts`](src/webmcp/adapter.ts) detects
whichever is present, so there is one file to change when the spec settles.

---

## Deploying

Static output, so any host works. Configs for two are committed:

```bash
npm run build            # -> dist/
netlify deploy --prod    # netlify.toml
vercel --prod            # vercel.json
```

**Then enable WebMCP for your visitors.** Without an origin trial token,
`navigator.modelContext` only exists for people who have manually turned on
`chrome://flags/#enable-webmcp-testing` — which no reviewer is going to do. Register
the deployed origin at [developer.chrome.com/origintrials](https://developer.chrome.com/origintrials),
then paste the token into the commented `<meta http-equiv="origin-trial">` tag in
[`index.html`](index.html) and redeploy. The header badge turns green when it works.

Tokens are origin-specific — one issued for a Netlify URL will not work on Vercel, or
on localhost. For local development, use the flag.

---

## Against the judging criteria

**WebMCP leverage.** 14 tools in a deliberate three-tier taxonomy, with refusal as a
designed result rather than an error path. Tools return structured JSON with both raw
numbers and display strings, per Chrome's tool-design guidance. The human-in-the-loop
gate is implemented the way Chrome documents it: the tool suspends and waits for a UI
confirmation it cannot itself provide.

**Execution.** No backend, no auth, no API keys — it deploys as static files. The rules
engine is pure functions with a test suite. TypeScript throughout, strict mode.
Degrades to a fully usable manual app when no agent is attached.

**Potential impact.** The football framing is the hook; the argument generalises. Any
domain with a real rulebook — tax, benefits eligibility, medical billing, export
control, clinical protocols — has the same shape, and the same problem: an agent that
sounds authoritative about arithmetic it cannot actually do. Putting the rulebook in
the page and forcing the agent through it is a reusable answer.

**Creativity & ambition.** Sport is absent from the WebMCP ecosystem. And the design
takes the harder position: rather than adding guardrails on top of a capable agent,
it removes the agent's ability to be wrong about the things that matter, and shows
you the refusal.

---

## Data and honesty

Club and player names are real, because the constraints only mean something if you
recognise them. **Every financial figure is invented** — fees, wages, contract lengths,
revenues, prior-season losses — and tuned so each club sits in a distinct, legible PSR
position. They are not club accounts and should not be cited as such.

The **rules** are real and public. That is the part worth learning, and the part the
page actually enforces.

Nothing here is financial advice, and no transfer is real.

## Licence

MIT — see [LICENSE](LICENSE).
