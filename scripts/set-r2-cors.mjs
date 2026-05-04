#!/usr/bin/env node
/**
 * Set CORS policy on the Cloudflare R2 bucket to allow browser PUT uploads.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=<token> node scripts/set-r2-cors.mjs
 *
 * The token needs "R2:Edit" permission on the account.
 * Create one at: https://dash.cloudflare.com/profile/api-tokens
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

// Load env from .env file (simple parser — no dotenv dependency needed)
function loadEnv() {
  try {
    const content = readFileSync(join(__dir, '..', '.env'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // .env not found — rely on environment variables
  }
}

loadEnv()

const apiToken = process.env.CLOUDFLARE_API_TOKEN
const accountId = process.env.R2_ACCOUNT_ID
const bucketName = process.env.R2_BUCKET_NAME

if (!apiToken) {
  console.error('Error: CLOUDFLARE_API_TOKEN is not set.')
  console.error('Create a token at https://dash.cloudflare.com/profile/api-tokens with R2:Edit permission.')
  process.exit(1)
}
if (!accountId || !bucketName) {
  console.error('Error: R2_ACCOUNT_ID and R2_BUCKET_NAME must be set in .env')
  process.exit(1)
}

const corsConfig = {
  rules: [
    {
      allowed: {
        origins: ['*'],
        methods: ['PUT'],
        headers: [
          'Content-Type',
          'Content-Length',
          'x-amz-checksum-crc32',
          'x-amz-sdk-checksum-algorithm',
        ],
      },
      exposeHeaders: ['ETag'],
      maxAgeSeconds: 3600,
    },
  ],
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`

console.log(`Setting CORS for bucket: ${bucketName} (account: ${accountId})`)
console.log('Config:', JSON.stringify(corsConfig, null, 2))

const response = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(corsConfig),
})

const text = await response.text()
let result
try {
  result = JSON.parse(text)
} catch {
  result = { raw: text }
}

if (!response.ok || result?.success === false) {
  console.error('Failed to set CORS:', JSON.stringify(result, null, 2))
  process.exit(1)
}

console.log('CORS policy set successfully.')
console.log('Result:', JSON.stringify(result, null, 2))
