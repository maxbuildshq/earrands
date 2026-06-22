# Bio Generation Prompt

Use this prompt when feeding bio research chunks to Claude Code. Use Sonnet model with low thinking effort.

## Prompt

You are generating artist bios for earrands, a festival timetable app. Read the bio research file I provide and generate a bio for each artist.

### Input format

The file is a JSON with an `artists` array. Each artist has:
- `sort_name` and `display_name`
- `bio_research` containing:
  - `soundcloud_bio` — often empty or junk (links, emails)
  - `discogs_bio` — often empty or discography-focused
  - `festival_bio` — may contain festival-specific language; `festival_bio_flagged` indicates it mentions the festival name
  - `web_sources` — array of `{url, title, snippet, content}` from web search

### Output format

Output a JSON file with this structure:
```json
{
  "generated_at": "<ISO timestamp>",
  "artists": [
    {
      "sort_name": "<same as input>",
      "display_name": "<same as input>",
      "bio": "<generated bio or null>",
      "bio_source": "generated",
      "bio_sources": [{"url": "<source URL>", "title": "<page title>", "type": "web"}],
      "confidence": "high|medium|low",
      "notes": "<any issues or uncertainties>"
    }
  ]
}
```

### Bio guidelines

- **Tone:** Neutral, music-focused, informative. Not promotional, not Wikipedia-formal. Think independent music magazine.
- **Length:** 3-5 sentences. Include a bit of story — how they got started, what defines their sound, notable milestones. Try to break a paragraph almost always even with a few sentences bio to make the text visually easily readable, try to make it at logically reasonable places.
- **Content:** Mention genre/style, origin/location if known, notable labels or releases, any distinctive characteristics.
- **Do not invent facts.** Only use information present in the sources. If sources conflict, use the most commonly cited version and note the discrepancy.
- **Do not copy text verbatim** from any source. Synthesize and rewrite.
- **Always generate a new bio** from all available sources — treat the festival bio as one input alongside SC description, Discogs profile, and web sources. Festival bios are often too long, promotional, or venue-specific, so always synthesize a fresh version. Always set `bio_source: "generated"`. The admin will decide whether to activate the generated bio or keep the festival original.
- **Festival bio flagging:** If `festival_bio_flagged` is true, the festival bio contains the festival's own name or venue-specific language — note this in `notes` and do not rely on it as a primary source. Use it only to cross-reference facts available elsewhere.
- **When sources are insufficient:** Set `bio` to null, `confidence` to "low", and explain in `notes` what's missing.
- **Source tracking:** Include in `bio_sources` only the URLs you actually used for the bio. This is for provenance tracking.

### Examples

Good bio:
> Speedy J is the alias of Dutch producer Jochem Paap, a pivotal figure in European techno since his debut on Plus 8 in 1990. Based in Rotterdam, he has continuously evolved his sound from early ambient techno through to the industrial-tinged productions he's known for today.
His label Electric Deluxe, founded in 2008, has become a platform for forward-thinking techno, while his STOOR project with Lucy pushed the boundaries of live performance.

Bad bio (too promotional):
> One of the most exciting artists in electronic music today, Speedy J brings an incredible energy to every performance and continues to push boundaries!

Bad bio (too factual/dry):
> Speedy J. Born 1969. Dutch. Techno producer. Labels: Plus 8, Novamute, Electric Deluxe.
