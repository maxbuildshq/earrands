import { execFileSync } from 'node:child_process'
import type { BioResearch } from './types.js'

function buildPrompt(artistName: string, research: BioResearch): string {
  const parts: string[] = []
  parts.push(`Generate an artist bio (2-3 short paragraphs, 3-5 sentences total across the whole bio) for "${artistName}".`)
  parts.push('Output ONLY the bio text, nothing else — no quotes, no prefix, no explanation, no markdown.')
  parts.push('Stay close to a 100-word target. Fewer (60-100 words) is fine when the sources are thin; NEVER exceed 100 words.')
  parts.push('Always split the bio into paragraphs — use blank lines between them, never one solid block.')
  parts.push('')
  parts.push('Guidelines:')
  parts.push('- Neutral, music-focused, informative. Think independent music magazine.')
  parts.push('- Include a bit of story — how they got started, what defines their sound, notable milestones.')
  parts.push('- Mention genre/style, origin/location if known, notable labels or releases.')
  parts.push('- Do not invent facts. Only use information from the sources below.')
  parts.push('- Do not copy text verbatim. Synthesize and rewrite.')
  parts.push('- NEVER include email addresses, phone numbers, booking contacts, or any personal contact information.')
  parts.push('- If sources are insufficient for a meaningful bio, respond with just: INSUFFICIENT')
  parts.push('')
  parts.push('--- SOURCES ---')

  if (research.soundcloud_bio) {
    parts.push(`\nSoundCloud description:\n${research.soundcloud_bio.slice(0, 500)}`)
  }
  if (research.discogs_bio) {
    parts.push(`\nDiscogs profile:\n${research.discogs_bio.slice(0, 1000)}`)
  }
  if (research.festival_bio) {
    const flag = research.festival_bio_flagged
      ? ' (WARNING: contains festival-specific language — use only for cross-referencing facts)'
      : ''
    parts.push(`\nFestival bio${flag}:\n${research.festival_bio.slice(0, 1000)}`)
  }
  for (const src of research.web_sources.slice(0, 5)) {
    const content = src.content?.slice(0, 1000) ?? src.snippet
    if (content) {
      parts.push(`\n${src.title} (${src.url}):\n${content}`)
    }
  }

  return parts.join('\n')
}

export function generateArtistBio(
  artistName: string,
  research: BioResearch,
): string | null {
  const prompt = buildPrompt(artistName, research)

  try {
    const result = execFileSync('claude', ['-p', '--model', 'sonnet'], {
      input: prompt,
      encoding: 'utf-8',
      timeout: 120_000,
      env: process.env,
    })

    let bio = result.trim()
    if (!bio || bio === 'INSUFFICIENT' || bio.length < 30) return null
    // Strip any contact info that slipped through
    bio = bio.replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, '')
    bio = bio.replace(/\+?\d[\d\s\-().]{7,}\d/g, '')
    bio = bio.replace(/  +/g, ' ').trim()
    return bio
  } catch (err: any) {
    const msg = err.stderr?.toString().trim() || err.stdout?.toString().trim() || err.message || String(err)
    console.error(`\n  Claude CLI error for ${artistName}: ${msg}`)
    return null
  }
}
