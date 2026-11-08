import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const commit = args.has('--commit')
const reportArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const reportPath = resolve(reportArg ?? 'verification-results/2026-11-03-resource-verification.json')

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

const report = JSON.parse(await readFile(reportPath, 'utf8'))
if (!Array.isArray(report.resources) || report.resources.length === 0) {
  throw new Error('The report contains no resource observations.')
}

const malformed = report.resources.filter(
  (resource) => !resource.id || !resource.url || !resource.check?.technical_status,
)
if (malformed.length > 0) {
  throw new Error(`The report has ${malformed.length} malformed resource observations.`)
}

const statusCounts = report.resources.reduce((counts, resource) => {
  const status = resource.check.technical_status
  counts[status] = (counts[status] ?? 0) + 1
  return counts
}, {})

console.log(`Report: ${reportPath}`)
console.log(`Observations: ${report.resources.length}`)
console.log(`Statuses: ${JSON.stringify(statusCounts)}`)

if (!commit) {
  console.log('Dry run complete. Re-run with --commit and a service-role credential to append the observations.')
  process.exit(0)
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')
}

const jwt = decodeJwtPayload(serviceRoleKey)
if (jwt?.role !== 'service_role') {
  throw new Error('Refusing to import: SUPABASE_SERVICE_ROLE_KEY is not a service-role JWT.')
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const runId = randomUUID()
const checks = report.resources.map((resource) => ({
  resource_id: resource.id,
  run_id: runId,
  checked_at: resource.check.checked_at,
  check_type: 'backfill',
  original_url: resource.check.original_url ?? resource.url,
  normalized_url: resource.check.normalized_url ?? null,
  status_code: resource.check.status_code ?? null,
  redirect_chain: resource.check.redirect_chain ?? [],
  final_url: resource.check.final_url ?? null,
  source_domain: resource.check.source_domain ?? null,
  response_time_ms: resource.check.response_time_ms ?? null,
  content_type: resource.check.content_type ?? null,
  technical_status: resource.check.technical_status,
  embed_status: resource.check.embed_status ?? 'unknown',
  auth_required: resource.check.auth_required ?? null,
  paywall_detected: resource.check.paywall_detected ?? null,
  destination_changed: resource.check.destination_changed ?? null,
  failure_reason: resource.check.failure_reason ?? null,
  checker_version: resource.check.checker_version ?? report.checker_version,
  observation: {
    consecutive_failures: resource.check.consecutive_failures ?? 0,
    youtube_oembed_status: resource.check.youtube_oembed_status ?? null,
    source_capture: report.inventory?.source_captured_at ?? null,
  },
}))

const failureStatuses = new Set(['broken', 'removed', 'needs_review', 'temporarily_unavailable', 'unknown'])
const failed = checks.filter((check) => failureStatuses.has(check.technical_status)).length
const timedOut = checks.filter((check) => check.failure_reason === 'timeout').length
const rateLimited = checks.filter((check) => check.status_code === 429).length
const redirected = checks.filter((check) => check.technical_status === 'redirected').length
const embedFailures = checks.filter((check) => check.embed_status === 'unavailable').length
const responseTimes = checks.map((check) => check.response_time_ms).filter(Number.isFinite)
const averageResponseMs = responseTimes.length
  ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
  : null

const { error: runError } = await client.from('resource_check_runs').insert({
  id: runId,
  source: 'backfill',
  checker_version: report.checker_version,
  started_at: report.started_at,
  finished_at: null,
  attempted: checks.length,
  status: 'running',
})
if (runError) throw runError

try {
  let inserted = 0
  for (const batch of chunks(checks, 100)) {
    const { error } = await client.from('resource_technical_checks').insert(batch)
    if (error) throw error
    inserted += batch.length
    console.log(`Inserted ${inserted}/${checks.length}`)
  }

  const { error: completionError } = await client
    .from('resource_check_runs')
    .update({
      finished_at: report.finished_at,
      succeeded: checks.length - failed,
      failed,
      timed_out: timedOut,
      rate_limited: rateLimited,
      redirected,
      embed_failures: embedFailures,
      average_response_ms: averageResponseMs,
      status: 'completed',
    })
    .eq('id', runId)
  if (completionError) throw completionError
  console.log(`Import complete. Run ID: ${runId}`)
} catch (error) {
  await client
    .from('resource_check_runs')
    .update({ finished_at: new Date().toISOString(), status: 'failed', error_detail: String(error) })
    .eq('id', runId)
  throw error
}
