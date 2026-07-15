import { execFileSync } from 'node:child_process'

/** Run the local claude CLI in print mode. Uses the user's subscription — no API key. */
export function callClaude(prompt: string, opts: { tools?: string; timeout: number }): string {
  const args = ['-p', '--model', 'sonnet']
  if (opts.tools) args.push('--allowed-tools', opts.tools)
  return execFileSync('claude', args, {
    input: prompt,
    encoding: 'utf-8',
    timeout: opts.timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  })
}

/** Strip markdown fences and any pre/post chatter around the JSON object. */
export function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return trimmed
  return trimmed.slice(start, end + 1)
}
