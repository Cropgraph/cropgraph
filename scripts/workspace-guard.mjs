#!/usr/bin/env node
// Workspace guard. Refuses an index that tracks an agent-workspace path or
// any symlink. Runs from the pre-commit hook and from CI, with no
// dependencies and nothing outside this repository.
//
//   node scripts/workspace-guard.mjs              check the index
//   node scripts/workspace-guard.mjs --self-test  prove the check can fail
//
// The check reads the index (git ls-files -s), so in the hook it sees
// exactly what the commit will contain, and in CI it sees what the
// checkout tracks. It honors GIT_INDEX_FILE, which is how the self-test
// points it at a temporary index.
//
// Three refusals: a path with a component named in
// scripts/workspace-guard.patterns, compared case-insensitively at any
// depth; a symlink (mode 120000); and an empty or sentinel-less listing,
// because a listing that cannot see pnpm-workspace.yaml proves nothing
// with a zero.
//
// Exit: 0 clean, 1 refused, 2 the guard itself is broken.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A root file every checkout of this monorepo tracks. This repository
// pins no skill library, so there is no .skills-pin.json to see.
const SENTINEL = 'pnpm-workspace.yaml'
const EMPTY_BLOB = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
const git = (args, env = process.env) =>
  execFileSync('git', args, { encoding: 'utf8', env, maxBuffer: 1 << 26 })
const top = git(['rev-parse', '--show-toplevel']).trim()
const patterns = readFileSync(join(top, 'scripts', 'workspace-guard.patterns'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
if (!patterns.length) {
  console.error('workspace-guard: BROKEN: the pattern file lists no names')
  process.exit(2)
}
const names = new Set(patterns.map((p) => p.toLowerCase()))

// Returns { refused: [reason strings], sentinel: bool, count: n }.
function check(env) {
  const out = git(['ls-files', '-s', '-z'], env)
  const refused = []
  let sentinel = false
  let count = 0
  for (const rec of out.split('\0')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    const mode = rec.slice(0, 6)
    const path = rec.slice(tab + 1)
    count++
    if (path === SENTINEL) sentinel = true
    const hit = path.split('/').find((c) => names.has(c.toLowerCase()))
    if (hit) refused.push(`${path}: component "${hit}" is an agent-workspace name`)
    if (mode === '120000') refused.push(`${path}: symlink (mode 120000)`)
  }
  return { refused, sentinel, count }
}

function report(r, label) {
  if (!r.count || !r.sentinel) {
    console.error(`workspace-guard: BROKEN: ${label} lists ${r.count} path(s) and the sentinel ${SENTINEL} ${r.sentinel ? 'was' : 'was NOT'} seen`)
    return 2
  }
  for (const line of r.refused) console.error(`workspace-guard: REFUSED ${line}`)
  if (r.refused.length) return 1
  console.log(`workspace-guard: ${label} clean: ${r.count} path(s), ${names.size} name(s), sentinel seen, 0 symlinks`)
  return 0
}

if (!process.argv.includes('--self-test')) process.exit(report(check(process.env), 'index'))

// Self-test. Each plant goes into its OWN temporary copy of the index and
// must be refused on its own, naming the planted path. The control, an
// untouched copy, must pass, so an always-refuse bug cannot read as a pass.
const realIndex = git(['rev-parse', '--git-path', 'index']).trim()
const tmp = mkdtempSync(join(tmpdir(), 'workspace-guard-'))
let failures = 0
let n = 0
const withIndex = (fn) => {
  const idx = join(tmp, `index-${n++}`)
  copyFileSync(realIndex.startsWith('/') ? realIndex : join(process.cwd(), realIndex), idx)
  return fn({ ...process.env, GIT_INDEX_FILE: idx })
}
const plant = (env, mode, path) =>
  git(['update-index', '--add', '--cacheinfo', `${mode},${EMPTY_BLOB},${path}`], env)
try {
  const control = withIndex((env) => check(env))
  if (control.refused.length || !control.sentinel) {
    console.error('workspace-guard: SELF-TEST FAILED: the untouched index copy did not pass')
    failures++
  }
  const cases = []
  for (const p of patterns) {
    // A name as a file at root and one level down, and as a directory at
    // root and one level down. Both shapes, because a name can be either.
    cases.push(['100644', p], ['100644', `packages/${p}`], ['100644', `${p}/probe`], ['100644', `packages/${p}/probe`])
  }
  cases.push(['120000', 'zz-guard-probe-link'], ['120000', 'packages/zz-guard-probe-link'])
  for (const [mode, path] of cases) {
    const r = withIndex((env) => { plant(env, mode, path); return check(env) })
    if (!r.refused.some((l) => l.startsWith(`${path}:`))) {
      console.error(`workspace-guard: SELF-TEST FAILED: planted ${mode} ${path} was not refused`)
      failures++
    }
  }
  if (failures) process.exit(2)
  console.log(`workspace-guard: self-test ok: control passed; ${cases.length} plant(s) each refused in its own temporary index`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
