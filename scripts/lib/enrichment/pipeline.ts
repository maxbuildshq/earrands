import { searchSoundCloud, searchInstagram } from './brave-search.js'
import { scrapeSoundCloudProfile, validateWithOEmbed } from './soundcloud.js'
import { searchDiscogsArtist } from './discogs.js'
import { isComboEntry } from './name-utils.js'
import { sleep } from '../../scrapers/base.js'
import type { EnrichmentField, EnrichmentResult, ArtistRow, Confidence } from './types.js'

export type PipelineConfig = {
  braveApiKey?: string
  discogsKey?: string
  discogsSecret?: string
  fields?: EnrichmentField[]
  onProgress?: (artist: string, step: string) => void
}

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

  // ── Step 2: Find Instagram via Brave (if still missing) ────────────────
  if (hasBrave && needsField(fields, 'instagram') && !result.instagram_url) {
    config.onProgress?.(artist.name, 'Brave → Instagram')
    try {
      const igUrl = await searchInstagram(artist.name, braveApiKey!)
      if (igUrl) {
        result.instagram_url = igUrl
        result.sources.push('brave-search-ig')
      }
    } catch (err: any) {
      if (err.message?.includes('rate limit')) throw err
      result.review_notes.push(`Brave IG search failed: ${err.message}`)
    }
    await sleep(300)
  }

  // ── Step 3: Discogs (supplementary: image, Bandcamp, SC/IG fallback) ────
  if (hasDiscogs) {
    const needsDiscogs = (needsField(fields, 'image') && !result.image_url) ||
                         (needsField(fields, 'bandcamp') && !result.bandcamp_url) ||
                         (needsField(fields, 'soundcloud') && !result.soundcloud_url) ||
                         (needsField(fields, 'instagram') && !result.instagram_url)

    if (needsDiscogs) {
      config.onProgress?.(artist.name, 'Searching Discogs')
      try {
        const discogs = await searchDiscogsArtist(artist.name, discogsKey!, discogsSecret!)
        if (discogs) {
          result.discogs_id = discogs.discogs_id
          if (!result.image_url && discogs.image_url) {
            result.image_url = discogs.image_url
            result.sources.push('discogs-image')
          }
          if (!result.bandcamp_url && discogs.bandcamp_url) {
            result.bandcamp_url = discogs.bandcamp_url
            result.sources.push('discogs-bandcamp')
          }
          if (!result.soundcloud_url && discogs.soundcloud_url) {
            result.soundcloud_url = discogs.soundcloud_url
            result.sources.push('discogs-soundcloud')
          }
          if (!result.instagram_url && discogs.instagram_url) {
            result.instagram_url = discogs.instagram_url
            result.sources.push('discogs-instagram')
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
  // Runs after all URL sources are exhausted — catches SC URLs from Google or Discogs.
  if (result.soundcloud_url) {
    const needsScrape = (needsField(fields, 'image') && !result.image_url) ||
                        (needsField(fields, 'instagram') && !result.instagram_url) ||
                        (needsField(fields, 'soundcloud') && !result.soundcloud_embed_url) ||
                        (needsField(fields, 'bandcamp') && !result.bandcamp_url)

    if (needsScrape) {
      config.onProgress?.(artist.name, 'Scraping SoundCloud profile')
      const profile = await scrapeSoundCloudProfile(result.soundcloud_url)
      if (profile) {
        if (!result.image_url && profile.image_url) {
          result.image_url = profile.image_url
          result.sources.push('soundcloud-image')
        }
        if (!result.instagram_url && profile.instagram_url) {
          result.instagram_url = profile.instagram_url
          result.sources.push('soundcloud-instagram')
        }
        if (!result.bandcamp_url && profile.bandcamp_url) {
          result.bandcamp_url = profile.bandcamp_url
          result.sources.push('soundcloud-bandcamp')
        }
        if (!result.soundcloud_embed_url) {
          // Profile URL embeds as a multi-track widget — oEmbed validates this in step 5
          result.soundcloud_embed_url = result.soundcloud_url
          result.sources.push('soundcloud-embed')
        }
      }
      await sleep(500)
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

  // ── Compute confidence ──────────────────────────────────────────────────
  result.confidence = computeConfidence(result)
  result.needs_review = result.confidence === 'low' || result.review_notes.length > 0

  return result
}

function computeConfidence(result: EnrichmentResult): Confidence {
  const hasCore = !!(result.soundcloud_url || result.instagram_url)
  const crossValidated = result.sources.includes('soundcloud-instagram') ||
    (result.sources.some(s => s.startsWith('brave-search')) && result.sources.some(s => s.startsWith('soundcloud-')))

  if (hasCore && crossValidated && result.image_url) return 'high'
  if (hasCore) return 'medium'
  return 'low'
}
