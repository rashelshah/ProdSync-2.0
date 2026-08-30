#!/usr/bin/env node
/**
 * ProdSync — Public Endpoint Verification Script
 *
 * Verifies that all public endpoints are accessible and return correct HTTP status codes.
 * Run against local dev server or production:
 *
 *   node scripts/verify-public.mjs
 *   node scripts/verify-public.mjs https://prodsync.in
 */

import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'

const BASE_URL = process.argv[2] ?? 'http://localhost:5173'
const isLocalhost = BASE_URL.includes('localhost')

let passed = 0
let failed = 0
const failures = []

function fetch(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const transport = url.protocol === 'https:' ? https : http

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
    }

    const req = transport.request(reqOptions, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })

    req.on('error', reject)
    req.end()
  })
}

async function check(label, urlPath, expectedStatus, bodyCheck = null, headerCheck = null) {
  const url = `${BASE_URL}${urlPath}`
  try {
    const res = await fetch(url)
    const statusOk = res.status === expectedStatus
    const bodyOk = bodyCheck ? bodyCheck(res.body) : true
    const headerOk = headerCheck ? headerCheck(res.headers) : true

    const ok = statusOk && bodyOk && headerOk
    const icon = ok ? '✅' : '❌'

    const issues = []
    if (!statusOk) issues.push(`status ${res.status} (expected ${expectedStatus})`)
    if (!bodyOk) issues.push(`body check failed`)
    if (!headerOk) issues.push(`header check failed`)

    console.log(`${icon} [${res.status}] ${label}${issues.length ? ' — ' + issues.join(', ') : ''}`)

    if (ok) passed++
    else {
      failed++
      failures.push({ label, url, issues })
    }
  } catch (err) {
    console.log(`❌ [ERR] ${label} — ${err.message}`)
    failed++
    failures.push({ label, url, issues: [err.message] })
  }
}

async function checkMarkdown(label, urlPath, expectedContentType) {
  const url = `${BASE_URL}${urlPath}`
  try {
    const res = await fetch(url, { headers: { 'Accept': 'text/markdown' } })
    const hasVary = (res.headers['vary'] ?? '').toLowerCase().includes('accept')
    const hasContentType = (res.headers['content-type'] ?? '').includes(expectedContentType)
    const hasBody = res.body.length > 100
    const ok = res.status === 200 && hasVary && hasContentType && hasBody

    const issues = []
    if (res.status !== 200) issues.push(`status ${res.status}`)
    if (!hasVary) issues.push(`missing Vary: Accept (got "${res.headers['vary']}")`)
    if (!hasContentType) issues.push(`wrong Content-Type (got "${res.headers['content-type']}")`)
    if (!hasBody) issues.push('empty body')

    console.log(`${ok ? '✅' : '❌'} [${res.status}] ${label}${issues.length ? ' — ' + issues.join(', ') : ''}`)
    if (ok) passed++
    else { failed++; failures.push({ label, url, issues }) }
  } catch (err) {
    console.log(`❌ [ERR] ${label} — ${err.message}`)
    failed++
    failures.push({ label, url, issues: [err.message] })
  }
}

console.log(`\n🔍 ProdSync Public Endpoint Verification`)
console.log(`   Target: ${BASE_URL}\n`)

// ─── Public pages ───────────────────────────────────────────────────────────
console.log('── Public Pages ─────────────────────────────')
await check('Homepage /', '/', 200, body => body.includes('ProdSync'))
await check('Pricing /pricing', '/pricing', 200)
await check('About /about', '/about', 200)
await check('Contact /contact', '/contact', 200)
await check('Privacy /privacy', '/privacy', 200)

// ─── Machine-readable files ───────────────────────────────────────────────
console.log('\n── Machine-Readable Resources ───────────────')
await check('robots.txt', '/robots.txt', 200, body => body.includes('Sitemap:') && body.includes('prodsync.in/sitemap.xml'))
await check('sitemap.xml', '/sitemap.xml', 200, body => body.includes('<urlset') && body.includes('prodsync.in'))
await check('llms.txt', '/llms.txt', 200, body => body.includes('ProdSync') && body.length > 200)
await check('llms.md', '/llms.md', 200, body => body.includes('ProdSync') && body.length > 200)

// ─── Metadata checks (HTML only, not for JS-rendered SPA in local dev) ────
console.log('\n── Homepage HTML Checks ─────────────────────')
await check('canonical meta', '/', 200, body => body.includes('rel="canonical"'))
await check('og:title meta', '/', 200, body => body.includes('og:title'))
await check('og:description meta', '/', 200, body => body.includes('og:description'))
await check('og:image meta', '/', 200, body => body.includes('og:image'))
await check('og:type meta', '/', 200, body => body.includes('og:type'))
await check('og:url meta', '/', 200, body => body.includes('og:url'))
await check('JSON-LD structured data', '/', 200, body => body.includes('application/ld+json') && body.includes('@type'))
await check('lang attribute', '/', 200, body => body.includes('lang="en"'))
await check('ProdSync in pre-JS content', '/', 200, body => body.includes('ProdSync'))

// ─── 404 behavior ──────────────────────────────────────────────────────────
// NOTE: 404 behavior is only testable against deployed Vercel (not local Vite dev)
// because Vite uses its own dev server without Vercel rewrite rules.
console.log('\n── 404 Behavior ─────────────────────────────')
if (!isLocalhost) {
  await check('Unknown route returns 404', '/definitely-does-not-exist-xyz-abc-123', 404)
  await check('Another unknown route returns 404', '/this-page-does-not-exist', 404)
} else {
  console.log('⚠️  [SKIP] 404 test — local Vite dev server does not honor Vercel rewrite rules.')
  console.log('           Test against https://prodsync.in after deployment.')
}

// ─── Backend markdown content negotiation ───────────────────────────────────
console.log('\n── Markdown Content Negotiation (Backend) ───')
if (!isLocalhost) {
  await checkMarkdown('/api/public/llms — Accept: text/markdown', '/api/public/llms', 'text/markdown')
} else {
  console.log('⚠️  [SKIP] /api/public/llms — run against deployed URL or start backend separately.')
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(48)}`)
console.log(`   Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.log('\n   Failed checks:')
  failures.forEach(f => console.log(`   • ${f.label} (${f.url})\n     ${f.issues.join(', ')}`))
}
console.log()

process.exit(failed > 0 ? 1 : 0)
