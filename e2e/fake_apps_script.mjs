// Runs apps-script/Code.gs locally against an in-memory Google Sheet, answering like a real
// Apps Script web app (POST → 302 → GET result). Rows go to e2e/out/sheet.json, mail to e2e/out/sheet-mail.jsonl.
import http from "node:http";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 54400), SECRET = process.env.SECRET ?? "test-secret";
const OUT = "e2e/out";
const grid = []; // rows of the "Waitlist" tab, row 1 = headers
const save = () => fs.writeFileSync(`${OUT}/sheet.json`, JSON.stringify(grid, null, 1));
const sheet = {
  getLastRow: () => grid.length,
  appendRow: (r) => { grid.push([...r]); save(); },
  setFrozenRows() {},
  deleteRow: (n) => { grid.splice(n - 1, 1); save(); },
  getRange: (row, col, nr = 1, nc = 1) => ({
    setFontWeight() { return this; },
    getValues: () => grid.slice(row - 1, row - 1 + nr).map((r) => { const x = r.slice(col - 1, col - 1 + nc); while (x.length < nc) x.push(""); return x; }),
    getValue: () => grid[row - 1][col - 1],
    setValue: (v) => { grid[row - 1][col - 1] = v; save(); },
  }),
};
const props = { SECRET };
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => crypto.randomUUID() },
  MailApp: { sendEmail: (m) => fs.appendFileSync(`${OUT}/sheet-mail.jsonl`, JSON.stringify(m) + "\n") },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
  console, Date, JSON, String, Number, Math,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("apps-script/Code.gs", "utf8"), ctx);

const results = new Map();
http.createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/result/")) {
    const body = results.get(req.url.slice(8)) ?? "{}";
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end(body);
  }
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    const out = req.method === "POST" ? ctx.doPost({ postData: { contents: data } }) : ctx.doGet();
    const id = crypto.randomUUID();
    results.set(id, out.t);
    res.writeHead(302, { Location: `http://127.0.0.1:${PORT}/result/${id}` }); res.end();
  });
}).listen(PORT, "127.0.0.1", () => console.log(`fake Apps Script on ${PORT}`));
