import { searchSoundCloud, searchInstagram, searchArtistBio } from './brave-search.js'
import { scrapeSoundCloudProfile, validateWithOEmbed } from './soundcloud.js'
import { searchDiscogsArtist } from './discogs.js'
import { scrapeBandcampProfile } from './bandcamp.js'
import { isComboEntry, extractInstagramHandle, normalizeSoundCloudUrl } from './name-utils.js'
import { extractFestivalRootName, bioContainsFestivalName } from '../ingest-diff.js'
import { sleep } from '../../scrapers/base.js'
import { scoreImageCandidates } from './image-scorer.js'
import { lookupMusicBrainzArtist, type MbEvidence } from './musicbrainz.js'
import { computeFieldConfidence, imageSourceConfidence, rankImageCandidate, type ResolutionEvidence } from './confidence.js'
import type { EnrichmentField, EnrichmentResult, ArtistRow, Confidence, BioResearch } from './types.js'

function normalizeBandcampUrl(url: string): string {
  return url.replace('://www.', '://')
}

export type PipelineConfig = {
  braveApiKey?: string
  discogsKey?: string
  discogsSecret?: string
  cloudflareAccountId?: string
  cloudflareApiToken?: string
  festivalName?: string
  fields?: EnrichmentField[]
  // 'graph' adds MusicBrainz corroboration + per-field confidence and collects ALL
  // image candidates (tagged, never excluded). Default 'legacy' keeps behavior unchanged.
  resolver?: 'legacy' | 'graph'
  searchKeywords?: string
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
    soundcloud_followers: artist.soundcloud_followers ?? null,
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
  const graph = config.resolver === 'graph'
  const bioOnly = fields?.length === 1 && fields[0] === 'bio'
  // Candidate collection runs for both; 'image-candidates' alone never touches the winner
  const wantsImages = needsField(fields, 'image') || needsField(fields, 'image-candidates')
  const candidatesOnly = !needsField(fields, 'image') && needsField(fields, 'image-candidates')
  const instagramCandidates: InstagramCandidate[] = []
  const imageCandidates: Array<{ url: string; source: string }> = []
  let scBio: string | null = null
  let discogsBio: string | null = null

  const verifiedDiscogsId = artist.discogs_id

  // Evidence collected along the way for per-field confidence (graph mode)
  let scSource: ResolutionEvidence['sc_source'] = artist.soundcloud_url ? 'db' : null
  let mbEvidence: MbEvidence | null = null
  let discogsLinksSc = false
  let discogsLinksIg = false
  let discogsLinksBc = false
  let discogsConflictsSc = false
  let discogsScUrl: string | null = null
  let braveScAgrees = false
  let braveScConflict = false
  let braveScUrl: string | null = null
  let bcSource: string | null = artist.bandcamp_url ? 'db' : null
  let locationSource: string | null = artist.city ? 'db' : null

  // Per-source fetch outcomes for the CLI row (see EnrichmentResult.fetch_log)
  let braveScError = false
  let braveIgError = false
  let discogsAttempted = false
  let discogsFound = false
  let discogsError = false
  let mbError = false

  if (!bioOnly) {
    // ── Step 1: Find SoundCloud via Brave ──────────────────────────────────
    // Field-scoped corroboration rule (ADR 011): when the run covers this field,
    // Brave runs even if a value exists — as a conflict-detection node. Runs that
    // don't cover the field skip it entirely.
    if (hasBrave && needsField(fields, 'soundcloud') && (!result.soundcloud_url || graph)) {
      config.onProgress?.(artist.name, 'Brave → SoundCloud')
      try {
        const scUrl = await searchSoundCloud(artist.name, braveApiKey!, config.searchKeywords)
        if (scUrl && !result.soundcloud_url) {
          result.soundcloud_url = scUrl
          result.sources.push('brave-search-sc')
          scSource = 'brave'
        } else if (scUrl && result.soundcloud_url) {
          if (normalizeSoundCloudUrl(scUrl) === normalizeSoundCloudUrl(result.soundcloud_url)) {
            braveScAgrees = true
          } else {
            braveScConflict = true
            braveScUrl = scUrl
            result.review_notes.push(`SoundCloud conflict: Brave top result ${scUrl} vs existing ${result.soundcloud_url}`)
          }
        }
      } catch (err: any) {
        if (err.message?.includes('rate limit')) throw err
        braveScError = true
        result.review_notes.push(`Brave SC search failed: ${err.message}`)
      }
      await sleep(300)
    }

    // ── Step 2: Find Instagram via Brave ───────────────────────────────────
    if (hasBrave && needsField(fields, 'instagram') && (!result.instagram_url || graph)) {
      config.onProgress?.(artist.name, 'Brave → Instagram')
      try {
        const igUrl = await searchInstagram(artist.name, braveApiKey!, config.searchKeywords)
        if (igUrl) {
          instagramCandidates.push({ url: igUrl, source: 'brave-search-ig' })
        }
      } catch (err: any) {
        if (err.message?.includes('rate limit')) throw err
        braveIgError = true
        result.review_notes.push(`Brave IG search failed: ${err.message}`)
      }
      await sleep(300)
    }

    // ── MusicBrainz corroboration lookup (graph resolver only) ──────────────
    // Evidence-only: MB never supplies field values, it confirms identities
    // found elsewhere via its CC0 URL relations. Removable without side effects.
    if (graph) {
      config.onProgress?.(artist.name, 'MusicBrainz corroboration')
      try {
        mbEvidence = await lookupMusicBrainzArtist(artist.name)
        if (mbEvidence) result.sources.push('musicbrainz')
      } catch (err: any) {
        mbError = true
        result.review_notes.push(`MusicBrainz lookup failed: ${err.message}`)
      }
    }

    // ── Step 3: Discogs (supplementary: image, Bandcamp, SC/IG fallback) ────
    if (hasDiscogs) {
      const needsDiscogs = wantsImages ||
                           needsField(fields, 'discogs') ||
                           (needsField(fields, 'bandcamp') && !result.bandcamp_url) ||
                           (needsField(fields, 'soundcloud') && !result.soundcloud_url) ||
                           needsField(fields, 'instagram')

      if (needsDiscogs) {
        discogsAttempted = true
        config.onProgress?.(artist.name, 'Searching Discogs')
        try {
          const discogs = await searchDiscogsArtist(artist.name, discogsKey!, discogsSecret!)
          if (discogs) {
            discogsFound = true
            result.discogs_id = discogs.discogs_id

            // Discogs name search can match the wrong artist. Only trust its images when
            // the Discogs page itself links out to a social profile — and that profile
            // doesn't contradict a SoundCloud URL we already confirmed via Brave/the DB.
            // Compare scheme/www-insensitively: Discogs often stores http:// links.
            const sameProfile = (a: string | null, b: string | null) =>
              !!a && !!b &&
              a.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') ===
              b.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
            const discogsConflictsWithKnownSc = !!(
              result.soundcloud_url && discogs.soundcloud_url &&
              !sameProfile(discogs.soundcloud_url, result.soundcloud_url)
            )
            const discogsHasCrossRef = !!(discogs.instagram_url || discogs.soundcloud_url)
            discogsConflictsSc = discogsConflictsWithKnownSc
            if (discogsConflictsWithKnownSc) discogsScUrl = discogs.soundcloud_url
            discogsLinksSc = sameProfile(result.soundcloud_url, discogs.soundcloud_url)
            discogsLinksBc = !!(result.bandcamp_url && discogs.bandcamp_url && normalizeBandcampUrl(discogs.bandcamp_url) === result.bandcamp_url)
            if (graph || (discogsHasCrossRef && !discogsConflictsWithKnownSc)) {
              // Graph mode: candidates from every source are always collected and
              // confidence-tagged — never excluded (tagging ranks the algo pick).
              for (let i = 0; i < discogs.all_images.length; i++) {
                imageCandidates.push({ url: discogs.all_images[i], source: i === 0 ? 'discogs-image' : `discogs-image-${i + 1}` })
              }
              if (graph && (!discogsHasCrossRef || discogsConflictsWithKnownSc)) {
                result.review_notes.push('Discogs images collected but low-confidence: no verified cross-reference to a known social profile')
              }
            } else if (discogs.all_images.length > 0) {
              result.review_notes.push('Discogs images skipped: no verified cross-reference to a known social profile')
            }

            if (!result.bandcamp_url && discogs.bandcamp_url) {
              result.bandcamp_url = normalizeBandcampUrl(discogs.bandcamp_url)
              result.sources.push('discogs-bandcamp')
              bcSource = 'discogs-bandcamp'
            }
            if (!result.soundcloud_url && discogs.soundcloud_url) {
              result.soundcloud_url = discogs.soundcloud_url
              result.sources.push('discogs-soundcloud')
              scSource = 'discogs'
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
          discogsError = true
          result.review_notes.push(`Discogs search failed: ${err.message}`)
        }
        await sleep(500)
      }
    }

    // ── Step 4: Scrape SoundCloud profile ───────────────────────────────────
    if (result.soundcloud_url) {
      const needsScrape = wantsImages ||
                          needsField(fields, 'instagram') ||
                          (needsField(fields, 'soundcloud') && !result.soundcloud_embed_url) ||
                          (needsField(fields, 'bandcamp') && !result.bandcamp_url)

      const needsLocation = needsField(fields, 'location') && !result.city
      const needsFollowers = needsField(fields, 'followers')

      if (needsScrape || needsLocation || needsFollowers) {
        config.onProgress?.(artist.name, 'Scraping SoundCloud profile')
        const profile = await scrapeSoundCloudProfile(result.soundcloud_url)
        if (profile) {
          if (profile.image_url) {
            // Unshift so SoundCloud's self-uploaded avatar is scored first — lets the
            // scorer's early-exit trust it before considering less reliable Discogs images.
            imageCandidates.unshift({ url: profile.image_url, source: 'soundcloud-image' })
          }
          if (profile.instagram_url) {
            instagramCandidates.push({ url: profile.instagram_url, source: 'soundcloud-instagram' })
          }
          if (!result.bandcamp_url && profile.bandcamp_url) {
            result.bandcamp_url = normalizeBandcampUrl(profile.bandcamp_url)
            result.sources.push('soundcloud-bandcamp')
            bcSource = 'soundcloud-bandcamp'
          }
          if (!result.soundcloud_embed_url) {
            result.soundcloud_embed_url = result.soundcloud_url
            result.sources.push('soundcloud-embed')
          }
          if (needsLocation && profile.city) {
            result.city = profile.city
            result.country_code = profile.country_code
            result.sources.push('soundcloud-location')
            locationSource = 'soundcloud-location'
          }
          // Capture followers whenever the profile was scraped — same call, so any run fills it in for free.
          if (profile.followers_count != null) {
            result.soundcloud_followers = profile.followers_count
            result.sources.push('soundcloud-followers')
          }
          if (profile.bio) {
            scBio = profile.bio
          }
        }
        await sleep(500)
      }
    }

    // ── Bandcamp location fallback ─────────────────────────────────────────
    if (needsField(fields, 'location') && !result.city && result.bandcamp_url) {
      config.onProgress?.(artist.name, 'Scraping Bandcamp location')
      const bc = await scrapeBandcampProfile(result.bandcamp_url)
      if (bc && (bc.city || bc.country_code)) {
        result.city = bc.city
        result.country_code = bc.country_code
        result.sources.push('bandcamp-location')
        locationSource = 'bandcamp-location'
      }
    }

    // ── Score image candidates and pick best ────────────────────────────────
    if (wantsImages && imageCandidates.length > 0) {
      const cfAccountId = config.cloudflareAccountId
      const cfApiToken = config.cloudflareApiToken
      const unscored = () => imageCandidates.map(c => ({
        ...c, score: 0, person_detected: false, person_count: 0, person_bbox_ratio: null,
      }))

      if (cfAccountId && cfApiToken && imageCandidates.length > 1) {
        config.onProgress?.(artist.name, 'Scoring images')
        try {
          const scored = await scoreImageCandidates(imageCandidates, {
            accountId: cfAccountId,
            apiToken: cfApiToken,
            dryRun: config.dryRun,
          })
          result.image_candidates = scored
          if (!candidatesOnly) {
            const best = scored.reduce((a, b) => b.score > a.score ? b : a)
            result.image_url = best.url
            result.sources.push(best.source)
          }
        } catch (err: any) {
          result.review_notes.push(`Image scoring failed, using priority fallback: ${err.message}`)
          result.image_candidates = unscored()
          if (!candidatesOnly) {
            const fallback = imageCandidates[0]
            result.image_url = fallback.url
            result.sources.push(fallback.source)
          }
        }
      } else {
        result.image_candidates = unscored()
        if (!candidatesOnly) {
          const fallback = imageCandidates[0]
          result.image_url = fallback.url
          result.sources.push(fallback.source)
        }
      }
    }

    // ── Resolve Instagram from candidates ───────────────────────────────────
    if (needsField(fields, 'instagram') && !result.instagram_url) {
      const resolved = resolveInstagram(instagramCandidates, result.review_notes)
      if (resolved) {
        result.instagram_url = resolved.url
        result.sources.push(resolved.source)
      }
    }

    // ── Validate SoundCloud embed ───────────────────────────────────────────
    if (result.soundcloud_embed_url) {
      config.onProgress?.(artist.name, 'Validating SC embed')
      const oembed = await validateWithOEmbed(result.soundcloud_embed_url)
      if (!oembed) {
        result.review_notes.push(`SoundCloud embed URL failed validation: ${result.soundcloud_embed_url}`)
        result.soundcloud_embed_url = null
      }
    }
  }

  // ── Bio research ──────────────────────────────────────────────────────────
  if (needsField(fields, 'bio') && hasBrave) {
    config.onProgress?.(artist.name, 'Bio research')

    const festivalBio = artist.bio ?? null
    const festivalRoot = config.festivalName ? extractFestivalRootName(config.festivalName) : null
    const festivalBioFlagged = !!(festivalBio && festivalRoot && bioContainsFestivalName(festivalBio, festivalRoot))

    const bioResearch: BioResearch = {
      soundcloud_bio: scBio,
      discogs_bio: discogsBio,
      festival_bio: festivalBio,
      festival_bio_flagged: festivalBioFlagged,
      web_sources: [],
    }

    try {
      await sleep(300)
      const webSources = await searchArtistBio(artist.name, braveApiKey!, true, config.searchKeywords)
      bioResearch.web_sources = webSources
    } catch (err: any) {
      if (err.message?.includes('rate limit')) throw err
      result.review_notes.push(`Bio search failed: ${err.message}`)
    }

    result.bio_research = bioResearch
    result.sources.push('bio-research')
  }

  // ── Per-field confidence + candidate tagging (graph resolver only) ───────
  if (graph) {
    const finalIgHandle = extractInstagramHandle(result.instagram_url ?? '')?.toLowerCase()
    const igAgreeing = finalIgHandle
      ? instagramCandidates.filter(c => extractInstagramHandle(c.url)?.toLowerCase() === finalIgHandle).map(c => c.source)
      : []
    // Conflict = resolveInstagram flagged one, or any candidate handle differs from
    // the final value (covers the existing-DB-value path resolveInstagram never sees)
    const igCandidateConflict = !!finalIgHandle && instagramCandidates.some(c => {
      const h = extractInstagramHandle(c.url)?.toLowerCase()
      return !!h && h !== finalIgHandle
    })
    const igConflict = result.review_notes.some(n => n.startsWith('Instagram conflict')) || igCandidateConflict
    if (igCandidateConflict && !result.review_notes.some(n => n.startsWith('Instagram conflict'))) {
      const differing = instagramCandidates.filter(c => extractInstagramHandle(c.url)?.toLowerCase() !== finalIgHandle)
      result.review_notes.push(`Instagram conflict: ${differing.map(c => `${c.source} found ${c.url}`).join('; ')} vs existing ${result.instagram_url}`)
    }
    discogsLinksIg = igAgreeing.includes('discogs-instagram')
    const igSource = igAgreeing[0] ?? (result.instagram_url ? 'db' : null)

    result.field_confidence = computeFieldConfidence({
      soundcloud_url: result.soundcloud_url,
      sc_source: scSource,
      instagram_url: result.instagram_url,
      ig_source: igSource,
      ig_agreeing_sources: igAgreeing,
      ig_conflict: igConflict,
      bandcamp_url: result.bandcamp_url,
      bc_source: bcSource,
      discogs_id: result.discogs_id,
      discogs_links_sc: discogsLinksSc,
      discogs_links_ig: discogsLinksIg,
      discogs_links_bc: discogsLinksBc,
      discogs_conflicts_sc: discogsConflictsSc,
      discogs_sc_url: discogsScUrl,
      brave_sc_agrees: braveScAgrees,
      brave_sc_conflict: braveScConflict,
      brave_sc_url: braveScUrl,
      city: result.city,
      location_source: locationSource,
      soundcloud_followers: result.soundcloud_followers,
      mb: mbEvidence,
    })

    // Tag every candidate with its source's identity confidence; re-rank the
    // winner by confidence tier — within a tier the SC avatar wins (usually the
    // most up-to-date, and the SC profile is the identity target anyway), then
    // DETR score breaks remaining ties. Tags never exclude.
    if (result.image_candidates?.length) {
      for (const c of result.image_candidates) {
        c.confidence = imageSourceConfidence(c.source, result.field_confidence)
      }
      // Persist candidates in selection-rank order so the carousel reads
      // best-first without re-deriving the ranking client-side
      result.image_candidates.sort((a, b) => rankImageCandidate(b) - rankImageCandidate(a))
      const best = result.image_candidates[0]
      if (!candidatesOnly && best.url !== result.image_url) {
        result.image_url = best.url
        result.sources.push(best.source)
      }
      result.field_confidence.image = candidatesOnly
        ? { level: best.confidence ?? 'low', evidence: [`${result.image_candidates.length} candidates collected — winner untouched (candidates-only run)`] }
        : { level: best.confidence ?? 'low', evidence: [`winner from ${best.source}`, `${result.image_candidates.length} candidates collected`] }
    } else if (result.image_url) {
      result.field_confidence.image = {
        level: imageSourceConfidence(result.sources.find(s => s.includes('image')) ?? '', result.field_confidence),
        evidence: ['single candidate, unscored'],
      }
    }
  }

  // ── Per-source fetch outcomes for the CLI row ────────────────────────────
  // Only actively-queried sources are logged (green=hit / red=miss|error).
  // Opportunistic/derived fields (embed/bc/loc/followers) are handled by the
  // CLI as green-when-present and stay off fetch_log to avoid red-everywhere noise.
  const fetchLog: Record<string, 'hit' | 'miss' | 'error'> = {}
  if (!bioOnly) {
    if (needsField(fields, 'soundcloud')) {
      fetchLog.sc = braveScError ? 'error' : result.soundcloud_url ? 'hit' : 'miss'
    }
    if (needsField(fields, 'instagram')) {
      fetchLog.ig = braveIgError ? 'error' : result.instagram_url ? 'hit' : 'miss'
    }
    if (graph) {
      fetchLog.mb = mbError ? 'error' : mbEvidence ? 'hit' : 'miss'
    }
    if (discogsAttempted) {
      fetchLog.dc = discogsError ? 'error' : discogsFound ? 'hit' : 'miss'
    }
    if (wantsImages) {
      const hasImage = candidatesOnly ? !!result.image_candidates?.length : !!result.image_url
      fetchLog.img = hasImage ? 'hit' : 'miss'
    }
  }
  if (needsField(fields, 'bio') && hasBrave) {
    const r = result.bio_research
    const hasBio = !!(r && (r.web_sources.length > 0 || r.soundcloud_bio || r.discogs_bio || r.festival_bio))
    fetchLog['bio-res'] = hasBio ? 'hit' : 'miss'
  }
  result.fetch_log = fetchLog

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
