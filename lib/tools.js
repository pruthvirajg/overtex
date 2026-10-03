/**
 * Shared OverTex tools. Used by the stdio MCP server and the hosted /mcp route.
 * Git sync needs a local checkout. The hosted route only runs the stateless tools.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function workspace() {
  const id = process.env.OVERLEAF_PROJECT_ID || "local";
  const root = process.env.OVERTEX_ROOT || path.join(process.cwd(), ".overtex");
  return path.join(root, id);
}

function authedRemote() {
  const id = process.env.OVERLEAF_PROJECT_ID;
  const token = process.env.OVERLEAF_GIT_TOKEN;
  if (!id || !token) return "";
  return `https://git:${encodeURIComponent(token)}@git.overleaf.com/${id}`;
}

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, out: out.slice(0, 8000), err: err.slice(0, 8000) }));
  });
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(path.relative(dir, full));
  }
  return acc;
}

function safeJoin(root, rel) {
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root))) throw new Error("Path escapes the project");
  return full;
}

function outline(tex) {
  const rows = [];
  const re = /\\(chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(tex))) rows.push({ level: m[1], title: m[2] });
  return rows;
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
    citeCount: cites.length,
    labelCount: labels.size,
  };
}

function wordCount(tex) {
  const plain = tex
    .replace(/\\(begin|end)\{[^}]+\}/g, " ")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
    .replace(/[{}%]/g, " ");
  const words = plain.split(/\s+/).filter(Boolean);
  return { words: words.length, chars: plain.length };
}

const TOOLS = [
  {
    name: "overtex_whoami",
    description: "Report which OverTex capabilities are available in this process.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "overleaf_pull",
    description: "Clone or pull the Overleaf git remote into the local workspace. Needs OVERLEAF_GIT_TOKEN and OVERLEAF_PROJECT_ID.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "overleaf_list_files",
    description: "List files in the local Overleaf checkout.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "overleaf_read",
    description: "Read a file from the checkout.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "overleaf_write",
    description: "Write a file in the checkout. Does not push.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "overleaf_push",
    description: "Commit and push the checkout to Overleaf. Requires confirm=true.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" }, confirm: { type: "boolean" } },
      required: ["confirm"],
    },
  },
  {
    name: "latex_outline",
    description: "List chapters and sections. Pass tex, or path inside the checkout.",
    inputSchema: {
      type: "object",
      properties: { tex: { type: "string" }, path: { type: "string" } },
    },
  },
  {
    name: "latex_check_refs",
    description: "Find dangling refs, unused labels, and cites missing from a bib string.",
    inputSchema: {
      type: "object",
      properties: { tex: { type: "string" }, path: { type: "string" }, bib: { type: "string" } },
    },
  },
  {
    name: "latex_word_count",
    description: "Rough word count after stripping commands.",
    inputSchema: {
      type: "object",
      properties: { tex: { type: "string" }, path: { type: "string" } },
    },
  },
  {
    name: "latex_compile",
    description: "Compile a .tex file with latexmk, pdflatex, or tectonic if one is installed.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

async function callTool(name, args = {}) {
  if (name === "overtex_whoami") {
    const compilers = {};
    for (const bin of ["latexmk", "pdflatex", "tectonic"]) {
      compilers[bin] = (await run(bin, ["--version"], process.cwd())).code === 0;
    }
    return {
      name: "OverTex.ai",
      projectId: process.env.OVERLEAF_PROJECT_ID || null,
      git: Boolean(process.env.OVERLEAF_GIT_TOKEN && process.env.OVERLEAF_PROJECT_ID),
      workspace: workspace(),
      compilers,
      note: "Not affiliated with Overleaf. Git sync needs a plan that includes the Git bridge.",
    };
  }
  if (name === "overleaf_pull") {
    const remote = authedRemote();
    if (!remote) throw new Error("Set OVERLEAF_GIT_TOKEN and OVERLEAF_PROJECT_ID");
    const dir = workspace();
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    if (!fs.existsSync(path.join(dir, ".git"))) {
      const clone = await run("git", ["clone", remote, dir], process.cwd());
      if (clone.code !== 0) throw new Error(clone.err || clone.out || "clone failed");
      return { ok: true, action: "clone", dir };
    }
    await run("git", ["remote", "set-url", "origin", remote], dir);
    let pull = await run("git", ["pull", "--rebase", "origin", "master"], dir);
    if (pull.code !== 0) pull = await run("git", ["pull", "--rebase", "origin", "main"], dir);
    if (pull.code !== 0) throw new Error(pull.err || pull.out);
    return { ok: true, action: "pull", dir };
  }
  if (name === "overleaf_list_files") return { files: walk(workspace()) };
  if (name === "overleaf_read") {
    const full = safeJoin(workspace(), args.path);
    return { path: args.path, content: fs.readFileSync(full, "utf8") };
  }
  if (name === "overleaf_write") {
    const full = safeJoin(workspace(), args.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, args.content);
    return { ok: true, bytes: Buffer.byteLength(args.content) };
  }
  if (name === "overleaf_push") {
    if (!args.confirm) throw new Error("Refusing to push without confirm=true");
    const remote = authedRemote();
    if (!remote) throw new Error("Set OVERLEAF_GIT_TOKEN and OVERLEAF_PROJECT_ID");
    const dir = workspace();
    await run("git", ["remote", "set-url", "origin", remote], dir);
    await run("git", ["add", "-A"], dir);
    const commit = await run("git", ["commit", "-m", args.message || "OverTex edit"], dir);
    const push = await run("git", ["push", "origin", "HEAD"], dir);
    if (push.code !== 0) throw new Error(push.err || commit.err || "push failed");
    return { ok: true, commit: commit.out, push: push.out };
  }
  const tex = args.tex || (args.path ? fs.readFileSync(safeJoin(workspace(), args.path), "utf8") : "");
  if (!tex && name !== "latex_compile") throw new Error("Pass tex or path");
  if (name === "latex_outline") return { outline: outline(tex) };
  if (name === "latex_check_refs") return checkRefs(tex, args.bib || "");
  if (name === "latex_word_count") return wordCount(tex);
  if (name === "latex_compile") {
    const full = safeJoin(workspace(), args.path);
    const dir = path.dirname(full);
    const base = path.basename(full);
    for (const [bin, binArgs] of [
      ["latexmk", ["-pdf", "-interaction=nonstopmode", base]],
      ["pdflatex", ["-interaction=nonstopmode", base]],
      ["tectonic", [base]],
    ]) {
      const which = await run(bin, ["--version"], dir);
      if (which.code !== 0) continue;
      const result = await run(bin, binArgs, dir);
      return { compiler: bin, code: result.code, log: (result.err + "\n" + result.out).slice(-4000) };
    }
    throw new Error("No latexmk, pdflatex, or tectonic on PATH");
  }
  throw new Error("Unknown tool " + name);
}

module.exports = { TOOLS, callTool };
