// Protoman's local gallery server — ships with the skill, generic across
// projects. No deps, no hosting. Run with cwd set to the project's
// ./protoman/ data directory (where round.json/feedback.json live) — this
// script's own directory only supplies the static gallery.html shell.
import { createServer } from "node:http"
import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ASSETS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.PROTOMAN_DATA_DIR || process.cwd()
const GALLERY = path.join(ASSETS_DIR, "gallery.html")
const FEEDBACK = path.join(DATA_DIR, "feedback.json")
const ROUND = path.join(DATA_DIR, "round.json")
const PORT = process.env.PROTOMAN_PORT || 4747

async function loadJSON(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return fallback
  }
}

async function saveFeedback(data) {
  await writeFile(FEEDBACK, JSON.stringify(data, null, 2))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === "GET" && url.pathname === "/") {
    const html = await readFile(GALLERY, "utf8") // shell — re-read every request, never edited per project
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
    return
  }

  if (req.method === "GET" && url.pathname === "/api/round") {
    const data = await loadJSON(ROUND, { round: null, variants: [] })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
    return
  }

  if (req.method === "GET" && url.pathname === "/api/feedback") {
    const data = await loadJSON(FEEDBACK, {})
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
    return
  }

  if (req.method === "POST" && url.pathname === "/api/feedback") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", async () => {
      try {
        const { round, variant, status } = JSON.parse(body)
        const data = await loadJSON(FEEDBACK, {})
        data[round] ??= {}
        data[round][variant] = { status, updatedAt: new Date().toISOString() }
        await saveFeedback(data)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }

  if (req.method === "POST" && url.pathname === "/api/messages") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", async () => {
      try {
        const { round, from, text, variant, id, pending, replyTo } = JSON.parse(body)
        const data = await loadJSON(FEEDBACK, {})
        data[round] ??= {}
        data[round]._messages ??= []
        const msgId = id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        const entry = {
          id: msgId,
          from,
          text,
          variant: variant || null,
          replyTo: replyTo || null,
          pending: !!pending,
          ts: new Date().toISOString(),
        }
        const idx = data[round]._messages.findIndex((m) => m.id === msgId)
        if (idx >= 0) data[round]._messages[idx] = { ...data[round]._messages[idx], ...entry }
        else data[round]._messages.push(entry)
        await saveFeedback(data)
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, id: msgId }))
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("not found")
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`protoman gallery: http://localhost:${PORT}  (data: ${DATA_DIR})`)
})
