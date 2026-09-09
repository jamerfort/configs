---
name: protoman
description: "Runs a design-survey loop for a project's UI: generate several visual variants of one component or decision, serve them in a local gallery where the user rates each one (Perfect/Ok/Egh/Yuck) and chats about whichever they're viewing, read that feedback back, and either iterate or promote the winner into the real source. Use when the user wants to try multiple UI design options, run a design survey, get feedback on prototype variants, or asks for 'protoman'."
---

Protoman separates *trying design options* from a project's real source. It runs entirely on
`localhost` — no hosting, no accounts. Prototypes, feedback, and decision history live under
`<project>/protoman/` — never inside the project's real source tree — until a design is
finalized, at which point the winning variant is hand-written into the real source matching
that project's own conventions.

## Two halves: the shell (this skill) and the data (the project)

`<skill-dir>` below is wherever this skill is installed — `~/.claude/skills/protoman/`
under Claude Code; substitute your own harness's skill path. The `<project>/protoman/`
data paths are project-relative and the same everywhere.

```
<skill-dir>/                # this skill's install dir
  SKILL.md
  assets/
    server.mjs             # the gallery server — generic, never edited per project
    gallery.html            # the gallery page itself — generic, never edited per project
    watch-feedback.mjs      # optional feedback watcher for a file-watch loop — generic

<project>/protoman/         # created fresh the first time this skill runs in a project
  state.json                 # machine state: server port, round history
  NOTES.md                    # human-readable decision log, newest round first
  round.json                  # THE ONLY FILE THAT CHANGES WHAT THE GALLERY SHOWS
  feedback.json                # written by the server: per-variant rating + the sidebar chat log
  rounds/
    round-01/
      a.html, b.html, ...    # each variant's mockup source (copied into round.json's "html" fields)
      brief.md                # what was being decided, the contract, options considered
```

**Never edit `assets/gallery.html` or `assets/server.mjs`.** They're the shared shell — the same
two files serve every project and every round. Your entire job per round is: write
`protoman/round.json` (which variants exist, right now) and read/write `protoman/feedback.json`
(ratings + chat). If a UI change is needed (layout, colors, a new mockup pattern), that's a
deliberate edit to the shell files in `<skill-dir>/assets/` — the user has to ask
for it explicitly, it isn't part of "run a round."

## round.json

```json
{
  "round": "round-01",
  "variants": [
    { "id": "a", "name": "A - Native+", "rationale": "one line", "html": "<div class=\"pm-a\">...self-contained mockup markup + its own scoped <style>...</div>" },
    { "id": "b", "name": "B - Menu list", "rationale": "...", "html": "..." }
  ]
}
```

`html` is a self-contained fragment (its own `<style>` scoped by a unique class per variant, e.g.
`.pm-a`) inserted into that variant's preview pane via `innerHTML` — style tags inside injected
HTML do apply, this works fine. Two hard rules the gallery shell depends on, both learned the
hard way in earlier use:

- **Every mockup's outer wrapper must set an explicit text `color`** matching its own hardcoded
  light-mode background — never rely on inheriting the page's `--fg`. `--fg` flips to near-white
  in dark mode; a mockup with a hardcoded light background and no explicit color renders
  invisible (light-on-light) for any viewer in dark mode.
- **A fake dropdown/menu must actually open on click**, not show permanently-visible "closed"
  and "open" states side by side. Wrap trigger + menu in `<div class="pm-demo">`, put
  `pm-toggle-trigger` on the trigger and `class="menu pm-toggle-menu" hidden` on the menu — the
  shell's shared delegated click handler opens/closes it and closes it on outside click.
- A genuinely native control (a real `<select>`) opens itself, but set `color-scheme: light` on
  it if the mockup only defines light colors — otherwise OS dark mode can render its native
  popup dark with your light-only text. Even then, that popup's exact styling is partly outside
  page CSS control on some platforms (Linux GTK theming, for one) — call that out to the user as
  a real tradeoff of choosing a native control over a custom one, not just a bug to chase forever.

## The contract

Before generating variants, pin down the *contract* the winning design must satisfy: the
props/data it receives and the events it must emit. Look at the actual component (or the spec
for a new one) to find this — its TypeScript interface, its prop types, whatever the project
uses. Variants are free to differ in layout, chrome, and interaction — never in what data they
need or what they emit — so the eventual winner drops into the real component with no ripple
through its callers.

Also skim the project's actual design tokens (a theme/CSS-variables file, a Tailwind config,
whatever it uses) and reuse them in variant mockups, so what the user reviews looks like it
belongs in their app rather than a generic mockup.

## Running a round

1. **Bootstrap** (first time only in this project): if `<project>/protoman/` doesn't exist,
   create it with empty `state.json` (`{"server": {"port": 4747}, "rounds": []}`) and `NOTES.md`
   (a one-line header).
2. **Scaffold**: `mkdir -p protoman/rounds/round-NN`, write a short `brief.md` there (what's
   being decided, the contract, 2-4 options and the one-line idea behind each).
3. **Build variants**: for each option, write a self-contained HTML/CSS mockup to
   `protoman/rounds/round-NN/<id>.html`. These are throwaway visual mockups, not real
   application code — don't wire them to the app's actual state or component library; just make
   them look right.
4. **Write `protoman/round.json`**: `{"round": "round-NN", "variants": [...]}`, one entry per
   option, `html` holding that variant's mockup (copy from the file you just wrote in step 3).
   This is the only file that changes what the gallery displays — replace it wholesale each
   round, don't append to old rounds' entries.
5. **Serve it**: check whether the server is already running
   (`curl -s -o /dev/null -w '%{http_code}' http://localhost:4747/` — a `200` means it's up; port
   comes from `state.json`'s `server.port`). If not, start it in the background with cwd set to
   the project's `protoman/` directory:
   `cd <project>/protoman && node <skill-dir>/assets/server.mjs`.
   Since it re-reads `round.json` and the shell from disk on every request, a running server
   never needs restarting between rounds — only start it once per machine session, and only
   restart it if `assets/server.mjs` itself changes (rare — that's a shell edit, not a round).
6. **Record round metadata** in `state.json` (round id, variant ids/names) and append a dated
   entry to `NOTES.md` (what's being decided and what the options are — outcome gets filled in
   once feedback comes back).
7. **Hand back the local link** (`http://localhost:<port>/`) and tell the user what to do: rate
   each option (Perfect / Ok / Egh / Yuck, in the top bar — clicking the active one again clears
   it), use the sidebar to talk about whichever one they're viewing, come back and say so (or
   just say "check protoman feedback").

## Reading feedback back

When the user says feedback is in (or you're asked to check), just read `protoman/feedback.json`
directly — it's a plain `{round: {variant: {status, updatedAt}}}` map, `status` one of
`"perfect"`, `"ok"`, `"egh"`, `"yuck"`, or `"pending"` (not rated yet). The reserved key
`_messages` (an array of `{id, from, text, variant, replyTo, pending, ts}`, `from` is `"user"` or
`"claude"`) is the round's sidebar chat thread — always check it, it often carries the most
useful framing ("B but with A's badge", "none of these, try...") and `variant` tells you which
design a comment is about without having to guess from wording.

To respond in that same panel (the point of the side-panel chat — it should feel like talking to
an agent, not filing a form): append a message with a fresh `id`, `from: "claude"`, `text`,
`variant` (set it when your reply is about one specific option, else `null`), and **`replyTo`**
set to a short quote of the user message you're answering — the panel renders it as a quoted
reference line so it's clear which prompt prompted the reply, don't skip it. For anything that
takes real work (reading code, testing a fix), post a placeholder first with the same `id` and
`pending: true` (renders a pulsing "still working" state), then POST again with the same `id`,
the finished `text`, and `pending: false` to update it in place — that's what makes the panel
feel like an active agent instead of a static log. Do this by reading `feedback.json`, appending/
upserting by `id`, and writing it back yourself, or via POST to `http://localhost:<port>/api/messages`
with `{round, id, from: "claude", text, variant, replyTo, pending}`. The gallery polls every
1.5s, so it shows up without the user refreshing. Do this for anything you fix or decide because
of their feedback — it's the running record they see live, not just `NOTES.md` after the fact.

Summarize what came back, append the outcome to `NOTES.md` under that round's entry (what was
rated how and why, quoting comments), and decide the next step:

- **One clear "perfect" (or the best of the batch), no blocking comments** → promote it: write
  the real component into the project's source following its existing conventions (check a
  sibling component for style), wire it into the contract you pinned earlier, and mark the round
  resolved in `state.json`/`NOTES.md`. Leave the round's files in `protoman/` as history; don't
  delete them.
- **Everything "egh"/"yuck", or comments pointing at specific fixes** → start a new round
  addressing the specific comments (reuse the same contract), going back to step 2. Don't
  regenerate options the notes already ruled out for the same reason — check `NOTES.md` first.
- **Mixed ratings / user hasn't weighed in yet** → report back and wait; don't guess.

## Notes

- Everything under `<project>/protoman/` is disposable except `NOTES.md` and `state.json`, which
  are the durable record of *why* — keep them accurate even across many rounds.
- If the server isn't running, the gallery still renders but rating/chat sends silently fail to
  persist until it's back (best-effort, no error banner).
- The server binds `0.0.0.0` and logs every LAN-reachable address on startup, so the gallery is
  reachable from other devices on the network, not just `localhost` — hand out whichever LAN
  address it printed if the user wants to review from another machine.
- To respond to feedback as it's submitted rather than waiting to be asked, watch
  `<project>/protoman/feedback.json` for changes — via your harness's file-watch
  capability, or a plain polling loop — running
  `cd <project>/protoman && node <skill-dir>/assets/watch-feedback.mjs`, which
  emits one line per changed entry, instead of polling.
- If a user asks for a layout/behavior change to the gallery itself (not the variants), that's an
  edit to `<skill-dir>/assets/gallery.html` and/or `server.mjs` — those changes
  apply to every project using this skill, so make them deliberately and keep this doc's
  description of the shell in sync with what you change.
