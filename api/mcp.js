const TOOLS = [
  { name: "overtex_whoami", description: "Hosted OverTex status. Git sync runs in the local stdio server.", inputSchema: { type: "object", properties: {} } },
  { name: "latex_outline", description: "List sections in a tex string.", inputSchema: { type: "object", properties: { tex: { type: "string" } }, required: ["tex"] } },
  { name: "latex_check_refs", description: "Dangling refs and unused labels.", inputSchema: { type: "object", properties: { tex: { type: "string" }, bib: { type: "string" } }, required: ["tex"] } },
  { name: "latex_word_count", description: "Rough word count.", inputSchema: { type: "object", properties: { tex: { type: "string" } }, required: ["tex"] } },
];

function outline(tex) {
  return [...tex.matchAll(/\\(chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/g)].map((m) => ({ level: m[1], title: m[2] }));
}
function checkRefs(tex, bib = "") {
  const labels = new Set([...tex.matchAll(/\\label\{([^}]+)\}/g)].map((m) => m[1]));
  const refs = [...tex.matchAll(/\\(?:ref|eqref|pageref|autoref)\{([^}]+)\}/g)].map((m) => m[1]);
  const cites = [...tex.matchAll(/\\cite[a-z]*\{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((s) => s.trim()));
  const bibKeys = new Set([...bib.matchAll(/@\w+\{([^,]+),/g)].map((m) => m[1].trim()));
  return {
    danglingRefs: [...new Set(refs.filter((r) => !labels.has(r)))],
    unusedLabels: [...labels].filter((l) => !refs.includes(l)),
    missingCites: bib ? [...new Set(cites.filter((c) => !bibKeys.has(c)))] : [],
  };
}
function words(tex) {
  const plain = tex.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, " ");
  return { words: plain.split(/\s+/).filter(Boolean).length };
}
function callTool(name, args = {}) {
  if (name === "overtex_whoami") return { name: "OverTex.ai", mode: "hosted", git: false, note: "Pull and push run on the local server in github.com/pruthvirajg/overtex" };
  if (name === "latex_outline") return { outline: outline(args.tex || "") };
  if (name === "latex_check_refs") return checkRefs(args.tex || "", args.bib || "");
  if (name === "latex_word_count") return words(args.tex || "");
  throw new Error("Unknown tool " + name);
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(body));
}
module.exports = async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { name: "OverTex.ai", tools: TOOLS.map((t) => t.name) });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let msg = {};
  try { msg = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return send(res, 400, { error: "Invalid JSON" }); }
  const { id, method, params } = msg;
  if (method === "initialize") return send(res, 200, { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "overtex", version: "0.1.0" } } });
  if (method === "tools/list") return send(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") {
    try {
      const data = callTool(params?.name, params?.arguments || {});
      return send(res, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
    } catch (err) {
      return send(res, 200, { jsonrpc: "2.0", id, error: { code: -32000, message: err.message } });
    }
  }
  send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: method || "missing method" } });
};
