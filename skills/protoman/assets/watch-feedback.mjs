// Emits one line per changed feedback entry, for the Monitor tool to turn
// into notifications. Ships with the skill; generic across projects — run
// with cwd set to the project's ./protoman/ data directory (or set
// PROTOMAN_DATA_DIR), same as assets/server.mjs.
import { watch } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

const DATA_DIR = process.env.PROTOMAN_DATA_DIR || process.cwd()
const FEEDBACK = path.join(DATA_DIR, "feedback.json")

async function load() {
  try {
    return JSON.parse(await readFile(FEEDBACK, "utf8"))
  } catch {
    return {}
  }
}

let prev = await load()

function diffAndPrint(next) {
  for (const round of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const prevRound = prev[round] || {}
    const nextRound = next[round] || {}

    for (const variant of new Set([...Object.keys(prevRound), ...Object.keys(nextRound)])) {
      if (variant === "_messages") continue
      const before = prevRound[variant]
      const after = nextRound[variant]
      if (!after || JSON.stringify(before) === JSON.stringify(after)) continue
      console.log(`${round}/${variant}: status=${after.status}`)
    }

    const prevMsgs = prevRound._messages || []
    const nextMsgs = nextRound._messages || []
    for (let i = prevMsgs.length; i < nextMsgs.length; i++) {
      const m = nextMsgs[i]
      if (m.from !== "user") continue // don't self-notify on Claude's own replies
      const tag = m.variant ? `, re variant ${m.variant}` : ""
      console.log(`${round}/chat (user${tag}): ${m.text}`)
    }
  }
  prev = next
}

let pending = false
const watcher = watch(FEEDBACK, { persistent: true }, async () => {
  if (pending) return
  pending = true
  setTimeout(async () => {
    pending = false
    diffAndPrint(await load())
  }, 150) // debounce: fs.watch can fire multiple times per write
})

process.on("SIGTERM", () => { watcher.close(); process.exit(0) })
