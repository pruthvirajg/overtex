const { TOOLS, callTool } = require("../lib/tools.js");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    res.end();
    return;
  }
  if (req.method === "GET") {
    return send(res, 200, {
      name: "OverTex.ai",
      mcp: "/mcp",
      tools: TOOLS.map((t) => t.name),
    });
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let msg;
  try {
    msg = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return send(res, 400, { error: "Invalid JSON" });
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "overtex", version: "0.1.0" },
      },
    });
  }
  if (method === "tools/list") return send(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") {
    try {
      const data = await callTool(params?.name, params?.arguments || {});
      return send(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
      });
    } catch (err) {
      return send(res, 200, { jsonrpc: "2.0", id, error: { code: -32000, message: err.message } });
    }
  }
  send(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: method || "missing method" } });
};
