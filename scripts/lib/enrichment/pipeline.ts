import { searchSoundCloud, searchInstagram, searchArtistBio } from './brave-search.js'
import { scrapeSoundCloudProfile, validateWithOEmbed } from './soundcloud.js'
import { searchDiscogsArtist } from './discogs.js'
import { isComboEntry, extractInstagramHandle } from './name-utils.js'
import { sleep } from '../../scrapers/base.js'
import { scoreImageCandidates } from './image-scorer.js'
import type { EnrichmentField, EnrichmentResult, ArtistRow, Confidence, BioResearch, BioSource } from './types.js'

export type PipelineConfig = {
  braveApiKey?: string
  discogsKey?: string
  discogsSecret?: string
  cloudflareAccountId?: string
  cloudflareApiToken?: string
  fields?: EnrichmentField[]
  dryRun?: boolean
  onProgress?: (artist: string, step: string) => void
}

type InstagramCandidate = { url: string; source: string }

function needsField(fields: EnrichmentField[] | undefined, field: EnrichmentField): boolean {
  return !fields || fields.includes(field)
}

export async function enrichArtist(
  artist: ArtistRow,
  config: PipelineConfig,
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    sort_name: artist.sort_name,
    display_name: artist.name,
    image_url: artist.image_url,
    instagram_url: artist.instagram_url,
    soundcloud_url: artist.soundcloud_url,
    soundcloud_embed_url: artist.soundcloud_embed_url,
    bandcamp_url: artist.bandcamp_url,
    discogs_id: artist.discogs_id,
    city: artist.city ?? null,
    country_code: artist.country_code ?? null,
    bio: artist.bio ?? null,
    bio_source: null,
    bio_festival: null,
    bio_sources: null,
    bio_research: null,
    confidence: 'low',
    sources: [],
    needs_review: false,
    review_notes: [],
  }

  if (isComboEntry(artist.sort_name, artist.is_collective)) {
    result.review_notes.push('Skipped: combo/temporary entry')
    return result
  }

  const { braveApiKey, discogsKey, discogsSecret, fields } = config
  const hasBrave = !!braveApiKey
  const hasDiscogs = !!(discogsKey && discogsSecret)
  const instagramCandidates: InstagramCandidate[] = []
  const imageCandidates: Array<{ url: string; source: string }> = []
  let scBio: string | null = null
  let discogsBio: string | null = null

  // Track which URLs were already verified (in DB before this run)
  // Location and bio should only be extracted from verified profiles
  const verifiedScUrl = artist.soundcloud_url
  const verifiedDiscogsId = artist.discogs_id

  // ── Step 1: Find SoundCloud via Brave ──────────────────────────────────
  if (hasBrave && needsField(fields, 'soundcloud') && !result.soundcloud_url) {
    config.onProgress?.(artist.name, 'Brave → SoundCloud')
    try {
      const scUrl = await searchSoundCloud(artist.name, braveApiKey!)
      if (scUrl) {
        result.soundcloud_url = scUrl
        result.sources.push('brave-search-sc')
      }
    } catch (err: any) {
      if (err.message?.includes('rate limit')) throw err
      result.review_notes.push(`Brave SC search failed: ${err.message}`)
    }
    await sleep(300)
  }

  // ── Step 2: Find Instagram via Brave ───────────────────────────────────
  if (hasBrave && needsField(fields, 'instagram') && !result.instagram_url) {
    config.onProgress?.(artist.name, 'Brave → Instagram')
    try {
      const igUrl = await searchInstagram(artist.name, braveApiKey!)
      if (igUrl) {
        instagramCandidates.push({ url: igUrl, source: 'brave-search-ig' })
      }
    } catch (err: any) {
      if (err.message?.includes('rate limit')) throw err
      result.review_notes.push(`Brave IG search failed: ${err.message}`)
    }
    await sleep(300)
  }

  // ── Step 3: Discogs (supplementary: image, Bandcamp, SC/IG fallback) ────
  if (hasDiscogs) {
    const needsDiscogs = needsField(fields, 'image') ||
                         (needsField(fields, 'bandcamp') && !result.bandcamp_url) ||
                         (needsField(fields, 'soundcloud') && !result.soundcloud_url) ||
                         needsField(fields, 'instagram')

    if (needsDiscogs || needsField(fields, 'bio')) {
      config.onProgress?.(artist.name, 'Searching Discogs')
      try {
        const discogs = await searchDiscogsArtist(artist.name, discogsKey!, discogsSecret!)
        if (discogs) {
          result.discogs_id = discogs.discogs_id
          if (discogs.image_url) {
            imageCandidates.push({ url: discogs.image_url, source: 'discogs-image' })
          }
          if (!result.bandcamp_url && discogs.bandcamp_url) {
            result.bandcamp_url = discogs.bandcamp_url
            result.sources.push('discogs-bandcamp')
          }
          if (!result.soundcloud_url && discogs.soundcloud_url) {
            result.soundcloud_url = discogs.soundcloud_url
            result.sources.push('discogs-soundcloud')
          }
          if (discogs.instagram_url) {
            instagramCandidates.push({ url: discogs.instagram_url, source: 'discogs-instagram' })
          }
          if (discogs.bio && verifiedDiscogsId) {
            discogsBio = discogs.bio
          }
        }
      } catch (err: any) {
        if (err.message?.includes('rate limit')) throw err
        result.review_notes.push(`Discogs search failed: ${err.message}`)
      }
      await sleep(500)
    }
  }

  // ── Step 4: Scrape SoundCloud profile ───────────────────────────────────
  if (result.soundcloud_url) {
    const needsScrape = needsField(fields, 'image') ||
                        needsField(fields, 'instagram') ||
                        (needsField(fields, 'soundcloud') && !result.soundcloud_embed_url) ||
                        (needsField(fields, 'bandcamp') && !result.bandcamp_url)

    const isVerifiedSc = !!verifiedScUrl
    const needsLocation = needsField(fields, 'location') && !result.city && isVerifiedSc
    const needsBioFragments = needsField(fields, 'bio') && isVerifiedSc

    if (needsScrape || needsLocation || needsBioFragments) {
      config.onProgress?.(artist.name, 'Scraping SoundCloud profile')
      const profile = await scrapeSoundCloudProfile(result.soundcloud_url)
      if (profile) {
        if (profile.image_url) {
          imageCandidates.push({ url: profile.image_url, source: 'soundcloud-image' })
        }
        if (profile.instagram_url) {
          instagramCandidates.push({ url: profile.instagram_url, source: 'soundcloud-instagram' })
        }
        if (!result.bandcamp_url && profile.bandcamp_url) {
          result.bandcamp_url = profile.bandcamp_url
          result.sources.push('soundcloud-bandcamp')
        }
        if (!result.soundcloud_embed_url) {
          result.soundcloud_embed_url = result.soundcloud_url
          result.sources.push('soundcloud-embed')
        }
        if (needsLocation && profile.city) {
          result.city = profile.city
          result.country_code = profile.country_code
          result.sources.push('soundcloud-location')
        }
        if (needsBioFragments && profile.bio) {
          scBio = profile.bio
        }
      }
      await sleep(500)
    }
  }

  // Note unverified SC URL when location/bio was requested but skipped
  if (result.soundcloud_url && !verifiedScUrl) {
    if (needsField(fields, 'location') && !result.city) {
      result.review_notes.push('Location skipped: SoundCloud URL not yet verified — run --apply first, then re-enrich with --fields=location')
    }
    if (needsField(fields, 'bio')) {
      result.review_notes.push('SC bio skipped: SoundCloud URL not yet verified — run --apply first, then re-enrich with --fields=bio')
    }
  }

  // ── Step 4b: Score image candidates and pick best ──────────────────────
  if (needsField(fields, 'image') && imageCandidates.length > 0) {
    const cfAccountId = config.cloudflareAccountId
    const cfApiToken = config.cloudflareApiToken

    if (cfAccountId && cfApiToken && imageCandidates.length > 1) {
      config.onProgress?.(artist.name, 'Scoring images')
      try {
        const scored = await scoreImageCandidates(imageCandidates, {
          accountId: cfAccountId,
          apiToken: cfApiToken,
          dryRun: config.dryRun,
        })
        result.image_candidates = scored
        const best = scored.reduce((a, b) => b.score > a.score ? b : a)
        result.image_url = best.url
        result.sources.push(best.source)
      } catch (err: any) {
        result.review_notes.push(`Image scoring failed, using priority fallback: ${err.message}`)
        const fallback = imageCandidates[0]
        result.image_url = fallback.url
        result.sources.push(fallback.source)
      }
    } else {
      // No CF credentials or only one candidate — use priority order (Discogs first)
      const fallback = imageCandidates[0]
      result.image_url = fallback.url
      result.sources.push(fallback.source)
    }
  }

  // ── Step 4c: Resolve Instagram from candidates ─────────────────────────
  if (needsField(fields, 'instagram') && !result.instagram_url) {
    const resolved = resolveInstagram(instagramCandidates, result.review_notes)
    if (resolved) {
      result.instagram_url = resolved.url
      result.sources.push(resolved.source)
    }
  }

  // ── Step 5: Validate SoundCloud embed ───────────────────────────────────
  if (result.soundcloud_embed_url) {
    config.onProgress?.(artist.name, 'Validating SC embed')
    const oembed = await validateWithOEmbed(result.soundcloud_embed_url)
    if (!oembed) {
      result.review_notes.push(`SoundCloud embed URL failed validation: ${result.soundcloud_embed_url}`)
      result.soundcloud_embed_url = null
    }
  }

  // ── Step 6: Bio research ────────────────────────────────────────────────
  if (needsField(fields, 'bio') && hasBrave) {
    config.onProgress?.(artist.name, 'Bio research')

    const festivalBio = artist.bio ?? null
    const festivalBioFlagged = false // flagging happens at ingest time, not enrichment

    const bioResearch: BioResearch = {
      soundcloud_bio: scBio,
      discogs_bio: discogsBio,
      festival_bio: festivalBio,
      festival_bio_flagged: festivalBioFlagged,
      web_sources: [],
    }

    try {
      await sleep(300)
      const webSources = await searchArtistBio(artist.name, braveApiKey!)
      bioResearch.web_sources = webSources
    } catch (err: any) {
      if (err.message?.includes('rate limit')) throw err
      result.review_notes.push(`Bio search failed: ${err.message}`)
    }

    result.bio_research = bioResearch

    const allSources: BioSource[] = []
    if (scBio) allSources.push({ url: result.soundcloud_url!, title: 'SoundCloud', snippet: scBio.slice(0, 200), type: 'soundcloud' })
    if (discogsBio) allSources.push({ url: `https://www.discogs.com/artist/${result.discogs_id}`, title: 'Discogs', snippet: discogsBio.slice(0, 200), type: 'discogs' })
    if (festivalBio) allSources.push({ url: '', title: 'Festival', snippet: festivalBio.slice(0, 200), type: 'festival' })
    allSources.push(...bioResearch.web_sources)
    result.bio_sources = allSources
    result.sources.push('bio-research')
  }

  // ── Compute confidence ──────────────────────────────────────────────────
  result.confidence = computeConfidence(result)
  result.needs_review = result.confidence === 'low' || result.review_notes.length > 0

  return result
}

export function resolveInstagram(
  candidates: InstagramCandidate[],
  reviewNotes: string[],
): InstagramCandidate | null {
  if (candidates.length === 0) {
    reviewNotes.push('No Instagram found from any source')
    return null
  }

  const withHandle = candidates.map(c => ({
    ...c,
    handle: extractInstagramHandle(c.url)?.toLowerCase(),
  }))

  const scIg = withHandle.find(c => c.source === 'soundcloud-instagram')
  const discogsIg = withHandle.find(c => c.source === 'discogs-instagram')
  const braveIg = withHandle.find(c => c.source === 'brave-search-ig')

  const authoritative = scIg ?? discogsIg

  if (authoritative && braveIg && authoritative.handle !== braveIg.handle) {
    reviewNotes.push(
      `Instagram conflict: Brave found ${braveIg.url}, artist profile links to ${authoritative.url} — using profile link`
    )
  }

  if (authoritative) return { url: authoritative.url, source: authoritative.source }

  if (braveIg) {
    reviewNotes.push(`Instagram from search only — no profile cross-validation: ${braveIg.url}`)
    return { url: braveIg.url, source: braveIg.source }
  }

  reviewNotes.push('No Instagram found from any source')
  return null
}

function computeConfidence(result: EnrichmentResult): Confidence {
  const hasCore = !!(result.soundcloud_url || result.instagram_url)
  const crossValidated = result.sources.includes('soundcloud-instagram') ||
    (result.sources.some(s => s.startsWith('brave-search')) && result.sources.some(s => s.startsWith('soundcloud-')))

  if (hasCore && crossValidated && result.image_url) return 'high'
  if (hasCore) return 'medium'
  return 'low'
}
