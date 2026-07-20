import { useState } from 'react'
import type { SetWithStage } from '../../types/database'
import { SetActions } from '../actions/SetActions'
import { BottomSheet } from '../common/BottomSheet'
import { ImageLightbox } from '../common/ImageLightbox'
import { Badge } from '../ui/Badge'
import { Heading } from '../ui/Heading'
import { imageCrossOrigin } from '../../lib/images'

type Props = {
  set: SetWithStage
  isGoing: boolean
  rating: -1 | 1 | null
  onToggleGoing: () => void
  onRate: (value: -1 | 1) => void
  onClose: () => void
  clashes?: SetWithStage[]
  showRating?: boolean
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

type ResolvedArtist = {
  name: string
  bio: string | null
  image_url: string | null
  instagram_url: string | null
  soundcloud_url: string | null
  soundcloud_embed_url: string | null
  bandcamp_url: string | null
}

function resolveArtists(set: SetWithStage): {
  comboBio: string | null
  artists: ResolvedArtist[]
} {
  const setArtists = set.set_artists ?? []
  const sorted = [...setArtists].sort((a, b) => a.billing_order - b.billing_order)

  const comboEntry = sorted.find(
    sa => sa.artists.name.toLowerCase() === set.artist_name.toLowerCase() && sa.artists.bio
  )

  const individuals = sorted.filter(
    sa => sa.artists.name.toLowerCase() !== set.artist_name.toLowerCase()
  )

  const isSolo = sorted.length === 1 && sorted[0].role === 'solo'

  if (isSolo) {
    const a = sorted[0].artists
    return {
      comboBio: null,
      artists: [{ name: a.name, bio: a.bio, image_url: a.image_url, instagram_url: a.instagram_url, soundcloud_url: a.soundcloud_url, soundcloud_embed_url: a.soundcloud_embed_url, bandcamp_url: a.bandcamp_url }],
    }
  }

  return {
    comboBio: comboEntry?.artists.bio ?? null,
    artists: individuals.map(sa => ({
      name: sa.artists.name,
      bio: sa.artists.bio,
      image_url: sa.artists.image_url,
      instagram_url: sa.artists.instagram_url,
      soundcloud_url: sa.artists.soundcloud_url,
      soundcloud_embed_url: sa.artists.soundcloud_embed_url,
      bandcamp_url: sa.artists.bandcamp_url,
    })),
  }
}

function SocialLinks({ artist }: { artist: ResolvedArtist }) {
  const links: Array<{ url: string; label: string; icon: React.ReactNode }> = []

  if (artist.instagram_url) {
    links.push({
      url: artist.instagram_url,
      label: 'Instagram',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    })
  }

  if (artist.soundcloud_url) {
    links.push({
      url: artist.soundcloud_url,
      label: 'SoundCloud',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      ),
    })
  }

  if (artist.bandcamp_url) {
    links.push({
      url: artist.bandcamp_url,
      label: 'Bandcamp',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z" />
        </svg>
      ),
    })
  }

  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {links.map(link => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 flex items-center justify-center border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          title={link.label}
          onClick={e => e.stopPropagation()}
        >
          {link.icon}
        </a>
      ))}
    </div>
  )
}

function ArtistImage({ url, name, size = 120 }: { url: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover border-2 border-border"
      style={{ width: size, height: size }}
      crossOrigin={imageCrossOrigin(url)}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

function SoundCloudEmbed({ embedUrl }: { embedUrl: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23CCFF00&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`

  return (
    <div className="mt-3">
      <iframe
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={src}
        title="SoundCloud player"
        onError={() => setFailed(true)}
        className="rounded"
      />
    </div>
  )
}

export function SetSheet({ set, isGoing, rating, onToggleGoing, onRate, onClose, clashes, showRating = true }: Props) {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null)

  const { comboBio, artists: resolvedArtists } = resolveArtists(set)
  const hasBio = comboBio || resolvedArtists.some(a => a.bio)
  const heroImage = resolvedArtists.length === 1 ? resolvedArtists[0].image_url : null
  const hasEnrichment = resolvedArtists.some(a => a.image_url || a.instagram_url || a.soundcloud_url || a.bandcamp_url || a.soundcloud_embed_url)
  const heroEmbed = resolvedArtists.length === 1 ? resolvedArtists[0].soundcloud_embed_url : null

  const headerContent = (
    <>
      <div className="flex items-start gap-3">
        {/* Artist image(s) on the left */}
        {heroImage && (
          <button className="shrink-0" onClick={() => setLightboxImage({ src: heroImage, alt: set.artist_name })}>
            <ArtistImage url={heroImage} name={set.artist_name} size={150} />
          </button>
        )}
        {!heroImage && resolvedArtists.length > 1 && resolvedArtists.some(a => a.image_url) && (() => {
          const PER_ROW = 3
          const withImages = resolvedArtists.filter(a => a.image_url)
          const imageSize = withImages.length <= 2 ? 100 : 64
          const overlap = imageSize * 0.132
          const rows: typeof withImages[] = []
          for (let i = 0; i < withImages.length; i += PER_ROW) rows.push(withImages.slice(i, i + PER_ROW))
          return (
            <div className="flex flex-col gap-1 shrink-0">
              {rows.map((row, ri) => (
                <div key={ri} className="flex">
                  {row.map((a, i) => (
                    <button key={a.name} style={{ zIndex: row.length - i, marginLeft: i > 0 ? -overlap : 0 }} onClick={() => setLightboxImage({ src: a.image_url!, alt: a.name })}>
                      <ArtistImage url={a.image_url!} name={a.name} size={imageSize} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        })()}

        {/* Title block */}
        <div className="min-w-0 flex-1">
          <Heading variant="card" className="text-xl leading-tight">
            {set.artist_name}
          </Heading>
          <div className="mt-1 text-base text-text-secondary space-y-0.5">
            {set.start_time && set.end_time && (
              <div>{formatTime(set.start_time)} – {formatTime(set.end_time)}</div>
            )}
            {(set.stages || set.performance_type) && (
              <div className="flex items-center gap-2">
                {set.stages && <span>{set.stages.name}</span>}
                {set.stages && set.performance_type && <span className="text-border">·</span>}
                {set.performance_type && <Badge variant="live" className="text-white">{set.performance_type === 'hybrid' ? 'Hybrid' : 'Live'}</Badge>}
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  )

  return (
    <BottomSheet onClose={onClose} headerContent={headerContent}>
      {/* Social links + action buttons — padded like all other content */}
      <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-1">
        <div>
          {resolvedArtists.length === 1 && <SocialLinks artist={resolvedArtists[0]} />}
        </div>
        <SetActions isGoing={isGoing} rating={rating} onToggleGoing={onToggleGoing} onRate={onRate} showRating={showRating} />
      </div>

      {clashes && clashes.length > 0 && (
        <div className="mx-4 mt-2 border-l-4 border-conflict bg-conflict/10 px-3 py-2">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-conflict mb-1">
            Clashes with {clashes.length} on your list
          </div>
          <div className="space-y-0.5">
            {clashes.map(c => (
              <div key={c.id} className="text-sm text-text-secondary truncate">
                {c.artist_name}
                {c.start_time && c.end_time && ` · ${formatTime(c.start_time)}–${formatTime(c.end_time)}`}
                {c.stages && ` · ${c.stages.name}`}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Divider */}
      {(hasBio || hasEnrichment) && <div className="h-px bg-border mx-4" />}

      {/* Bios + embeds */}
      {(hasBio || hasEnrichment) && (
        <div className="px-4 py-3">
          {/* Combo bio */}
          {comboBio && (
            <div className="mb-4">
              <p className="text-base text-text-primary leading-relaxed whitespace-pre-line">
                {comboBio}
              </p>
            </div>
          )}

          {/* Solo artist: SoundCloud embed before bio */}
          {heroEmbed && <SoundCloudEmbed embedUrl={heroEmbed} />}

          {/* Individual artist sections */}
          {resolvedArtists.map((artist, idx) => {
            const hasContent = artist.bio || (resolvedArtists.length > 1 && (artist.instagram_url || artist.soundcloud_url || artist.bandcamp_url || artist.soundcloud_embed_url))
            if (!hasContent) return null

            return (
              <div key={artist.name} className={idx > 0 || comboBio || heroEmbed ? 'mt-4' : ''}>
                {/* Artist name divider (only for multi-artist sets) */}
                {resolvedArtists.length > 1 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="font-mono text-xs tracking-widest text-text-secondary uppercase">
                      {artist.name}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}

                {/* Multi-artist: social links per artist */}
                {resolvedArtists.length > 1 && (
                  <div className="mb-2">
                    <SocialLinks artist={artist} />
                  </div>
                )}

                {/* Bio */}
                {artist.bio && (
                  <p className="text-base text-text-primary leading-relaxed whitespace-pre-line">
                    {artist.bio}
                  </p>
                )}

                {/* Multi-artist: individual SC embeds */}
                {resolvedArtists.length > 1 && artist.soundcloud_embed_url && (
                  <SoundCloudEmbed embedUrl={artist.soundcloud_embed_url} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightboxImage && (
        <ImageLightbox src={lightboxImage.src} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />
      )}
    </BottomSheet>
  )
}
