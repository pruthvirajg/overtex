# OverTex.ai

MCP skill and server for Overleaf and LaTeX. Claude, Cursor, or any MCP client can pull a project, edit the `.tex`, check refs, compile if a TeX binary is installed, and push back.

Not affiliated with Overleaf. Git sync uses Overleaf’s official Git bridge and needs a plan that includes it.

## Install

```bash
claude mcp add overtex \
  -e OVERLEAF_GIT_TOKEN=olp_your_token \
  -e OVERLEAF_PROJECT_ID=your_project_id \
  -- node /path/to/overtex/src/server.mjs
```

Cursor / Claude Desktop: see `examples/mcp.json`.

Hosted connector (stateless LaTeX tools only): `https://overtex.vercel.app/mcp` after deploy.

## Skill

`skills/overtex/SKILL.md` tells the agent to pull before write, check refs, and push only with `confirm: true`.

## Tools

| Tool | What it does |
| --- | --- |
| overtex_whoami | Git token present, compilers on PATH |
| overleaf_pull | Clone or pull the Git bridge |
| overleaf_list_files | List the checkout |
| overleaf_read / overleaf_write | File IO inside the checkout |
| overleaf_push | Commit and push, requires confirm |
| latex_outline | Sections |
| latex_check_refs | Dangling refs, unused labels, missing cites |
| latex_word_count | Rough count |
| latex_compile | latexmk, pdflatex, or tectonic |
