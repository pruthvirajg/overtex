---
name: overtex
description: "Pull, edit, check, and push Overleaf LaTeX with OverTex.ai. Use when the user wants an Overleaf project, a .tex resume or paper, dangling refs, a compile, or an MCP sync to Overleaf."
type: workflow
lifecycle: active
---

# OverTex.ai — Overleaf from the chat

Use the OverTex MCP tools. Do not paste a whole paper back and forth if the tools are connected.

OverTex is not affiliated with Overleaf. Git sync needs an Overleaf plan that includes the Git bridge, plus `OVERLEAF_GIT_TOKEN` and `OVERLEAF_PROJECT_ID`.

## Workflow

1. Call `overtex_whoami`. If `git` is false, edit a local `.tex` the user pasted and say the Git bridge is missing.
2. Call `overleaf_pull` before reading. Never write from a stale checkout.
3. Call `overleaf_list_files`, then `overleaf_read` on the root `.tex` and any file you will change.
4. Edit with `overleaf_write`. Change the smallest file that holds the section. Do not invent citations, results, employers, or metrics.
5. Call `latex_check_refs` and `latex_outline` on the file you wrote.
6. Call `latex_compile` if a compiler is on PATH. Fix the log before pushing.
7. Show the diff in chat. Call `overleaf_push` only after the user agrees, with `confirm: true`.

## Resume pass

Read the master `.tex` and the job description. Rewrite summary and bullets only where the source already supports the claim. Then `latex_word_count`. One page stays one page.

## Do not

- Push without `confirm: true`.
- Put the git token in a file or a commit message.
- Overwrite a file you have not read in this turn.
