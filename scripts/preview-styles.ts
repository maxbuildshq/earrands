import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '../style-previews')

const MOCK_FESTIVAL = 'SONUS FESTIVAL'
const MOCK_SETS = [
  { day: 'FRI', time: '23:00', artist: 'Surgeon' },
  { day: 'FRI', time: '00:30', artist: 'Blawan' },
  { day: 'FRI', time: '02:00', artist: 'Paula Temple' },
  { day: 'FRI', time: '03:30', artist: 'Perc' },
  { day: 'SAT', time: '22:00', artist: 'Rebekah' },
  { day: 'SAT', time: '23:30', artist: 'Dax J' },
  { day: 'SAT', time: '01:00', artist: 'DVS1' },
  { day: 'SAT', time: '02:30', artist: 'Speedy J' },
  { day: 'SAT', time: '04:00', artist: 'Ancient Methods' },
  { day: 'SUN', time: '23:00', artist: 'Function' },
  { day: 'SUN', time: '01:00', artist: 'Shifted' },
]

// ─── Style 1: Poster / Rave Flyer ────────────────────────────────────────────

function style1_poster(): string {
  const rows = MOCK_SETS.map(s => `
    <div class="row">
      <span class="time">${s.time}</span>
      <span class="artist">${s.artist}</span>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #080808;
  font-family: 'Space Mono', monospace;
  position: relative;
}
.noise {
  position: absolute; inset: 0; z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.35;
  pointer-events: none;
}
.hero {
  position: absolute;
  top: -30px; left: -20px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 340px;
  line-height: 0.88;
  letter-spacing: -8px;
  color: #111111;
  text-transform: uppercase;
  z-index: 0;
  white-space: nowrap;
  overflow: hidden;
  width: 1200px;
  user-select: none;
}
.content {
  position: relative; z-index: 2;
  padding: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.badge {
  font-size: 26px;
  letter-spacing: 6px;
  color: #CCFF00;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.festival-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 148px;
  line-height: 0.9;
  letter-spacing: -3px;
  color: #FFFFFF;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.tagline {
  font-size: 28px;
  letter-spacing: 4px;
  color: #CCFF00;
  margin-bottom: 60px;
  text-transform: uppercase;
}
.divider {
  width: 100%;
  height: 2px;
  background: #CCFF00;
  margin-bottom: 48px;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 32px;
  margin-bottom: 28px;
}
.time {
  font-size: 28px;
  color: #CCFF00;
  min-width: 110px;
  letter-spacing: 1px;
}
.artist {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 58px;
  color: #FFFFFF;
  letter-spacing: 1px;
  text-transform: uppercase;
  line-height: 1;
}
.footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.footer-url {
  font-size: 24px;
  color: #444;
  letter-spacing: 2px;
}
.footer-dot {
  width: 12px; height: 12px;
  background: #CCFF00;
  border-radius: 50%;
}
</style>
</head>
<body>
<div class="noise"></div>
<div class="hero">${MOCK_FESTIVAL}</div>
<div class="content">
  <div>
    <div class="badge">Festival Pulse</div>
    <div class="festival-name">${MOCK_FESTIVAL}</div>
    <div class="tagline">My Schedule</div>
    <div class="divider"></div>
    ${rows}
  </div>
  <div class="footer">
    <div class="footer-url">festivalpulse.app</div>
    <div class="footer-dot"></div>
  </div>
</div>
</body>
</html>`
}

// ─── Style 2: Ticket Stub ─────────────────────────────────────────────────────

function style2_ticket(): string {
  const topSets = MOCK_SETS.slice(0, 5)
  const bottomSets = MOCK_SETS.slice(5)

  const topRows = topSets.map(s => `
    <div class="top-row">
      <span class="top-artist">${s.artist.toUpperCase()}</span>
      <span class="top-time">${s.time}</span>
    </div>
  `).join('')

  const bottomRows = bottomSets.map(s => `
    <div class="bottom-row">
      <span class="b-day">${s.day}</span>
      <span class="b-time">${s.time}</span>
      <span class="b-artist">${s.artist}</span>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #F0EBE0;
  font-family: 'Space Mono', monospace;
  display: flex;
  flex-direction: column;
}
.top {
  flex: 0 0 1100px;
  background: #0A0A0A;
  padding: 100px 80px 80px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}
.top-bg-text {
  position: absolute;
  bottom: -60px; right: -20px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 280px;
  color: #1A1A1A;
  text-transform: uppercase;
  line-height: 1;
  pointer-events: none;
}
.top-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.top-brand {
  font-size: 24px;
  letter-spacing: 5px;
  color: #CCFF00;
  text-transform: uppercase;
}
.top-barcode {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 50px;
}
.top-barcode span {
  background: #333;
  width: 4px;
  display: block;
}
.top-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 160px;
  line-height: 0.88;
  letter-spacing: -4px;
  color: #FFFFFF;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}
.top-rows {
  position: relative; z-index: 1;
}
.top-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-top: 1px solid #222;
  padding: 18px 0;
}
.top-artist {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 52px;
  color: #FFFFFF;
  letter-spacing: 1px;
}
.top-time {
  font-size: 24px;
  color: #CCFF00;
}

/* Tear line */
.tear {
  height: 48px;
  background: #F0EBE0;
  position: relative;
  display: flex;
  align-items: center;
}
.tear::before {
  content: '';
  position: absolute;
  left: 0; right: 0; top: 50%;
  border-top: 3px dashed #BBB4A8;
}
.tear-circle-left {
  position: absolute; left: -24px; top: 50%;
  transform: translateY(-50%);
  width: 48px; height: 48px;
  background: #F0EBE0;
  border-radius: 50%;
}
.tear-circle-right {
  position: absolute; right: -24px; top: 50%;
  transform: translateY(-50%);
  width: 48px; height: 48px;
  background: #F0EBE0;
  border-radius: 50%;
}
.tear-label {
  margin: 0 auto;
  background: #F0EBE0;
  padding: 0 20px;
  font-size: 20px;
  letter-spacing: 4px;
  color: #BBB4A8;
  text-transform: uppercase;
  position: relative; z-index: 1;
}

/* Stub */
.stub {
  flex: 1;
  padding: 60px 80px;
  display: flex;
  flex-direction: column;
}
.stub-title {
  font-size: 22px;
  letter-spacing: 5px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 40px;
}
.bottom-row {
  display: flex;
  align-items: baseline;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid #D9D4CA;
}
.b-day {
  font-size: 20px;
  color: #AAA;
  min-width: 60px;
  letter-spacing: 2px;
}
.b-time {
  font-size: 24px;
  color: #0A0A0A;
  min-width: 90px;
}
.b-artist {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 46px;
  color: #0A0A0A;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.stub-footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 40px;
  border-top: 1px solid #CCC;
}
.stub-url {
  font-size: 20px;
  color: #AAA;
  letter-spacing: 2px;
}
.stub-qr {
  width: 80px; height: 80px;
  background: repeating-conic-gradient(#CCC 0% 25%, #FFF 0% 50%) 0 0 / 12px 12px;
  opacity: 0.6;
}
</style>
</head>
<body>
<div class="top">
  <div class="top-bg-text">SONUS</div>
  <div class="top-header">
    <div class="top-brand">Festival Pulse</div>
    <div class="top-barcode">
      ${Array.from({length: 28}, (_, i) => `<span style="height:${20 + Math.sin(i * 1.7) * 18 + Math.cos(i * 2.3) * 12}px"></span>`).join('')}
    </div>
  </div>
  <div class="top-name">${MOCK_FESTIVAL}</div>
  <div class="top-rows">${topRows}</div>
</div>
<div class="tear">
  <div class="tear-circle-left"></div>
  <div class="tear-circle-right"></div>
  <div class="tear-label">Keep this stub</div>
</div>
<div class="stub">
  <div class="stub-title">More sets →</div>
  ${bottomRows}
  <div class="stub-footer">
    <div class="stub-url">festivalpulse.app</div>
    <div class="stub-qr"></div>
  </div>
</div>
</body>
</html>`
}

// ─── Style 3: Glitch / Signal ─────────────────────────────────────────────────

function style3_glitch(): string {
  const rows = MOCK_SETS.map((s, i) => {
    const offset = (i % 3 === 0) ? 4 : (i % 3 === 1) ? -3 : 2
    return `
    <div class="row ${i % 4 === 0 ? 'glitch' : ''}">
      <span class="time">${s.time}</span>
      <span class="artist" style="--ox:${offset}px">${s.artist.toUpperCase()}</span>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #050505;
  font-family: 'Space Mono', monospace;
  position: relative;
}

/* scanlines */
body::after {
  content: '';
  position: fixed; inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.18) 3px,
    rgba(0,0,0,0.18) 4px
  );
  pointer-events: none;
  z-index: 100;
}

/* vignette */
body::before {
  content: '';
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%);
  pointer-events: none;
  z-index: 99;
}

.content {
  position: relative; z-index: 2;
  padding: 100px 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.signal-bar {
  width: 60px; height: 6px;
  background: #FF003C;
  margin-bottom: 8px;
  box-shadow: 0 0 12px #FF003C;
}
.signal-bar2 {
  width: 120px; height: 3px;
  background: #00FFAA;
  margin-bottom: 48px;
  box-shadow: 0 0 8px #00FFAA;
}

.badge {
  font-size: 24px;
  letter-spacing: 6px;
  color: #555;
  margin-bottom: 20px;
}
.festival-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 140px;
  line-height: 0.88;
  letter-spacing: -3px;
  color: #FFFFFF;
  text-transform: uppercase;
  text-shadow:
    -4px 0 #FF003C,
    4px 0 #00FFAA;
  margin-bottom: 16px;
}
.sub {
  font-size: 26px;
  letter-spacing: 5px;
  color: #333;
  margin-bottom: 60px;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 36px;
  margin-bottom: 30px;
}
.time {
  font-size: 26px;
  color: #FF003C;
  min-width: 110px;
  text-shadow: 0 0 8px #FF003C;
  letter-spacing: 2px;
}
.artist {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 64px;
  color: #FFFFFF;
  letter-spacing: 2px;
  line-height: 1;
  text-shadow:
    calc(var(--ox, 3px)) 0 #FF003C,
    calc(-1 * var(--ox, 3px)) 0 #00FFAA;
  position: relative;
}
.row.glitch .artist::before {
  content: attr(data-text);
  position: absolute;
  left: 6px; top: 0;
  color: #FF003C;
  opacity: 0.4;
  clip-path: polygon(0 30%, 100% 30%, 100% 50%, 0 50%);
}

.h-line {
  height: 1px;
  background: linear-gradient(90deg, #FF003C, #00FFAA, transparent);
  margin: 8px 0 40px;
  opacity: 0.5;
}

.footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.footer-url {
  font-size: 22px;
  color: #333;
  letter-spacing: 3px;
}
.footer-rec {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #FF003C;
  box-shadow: 0 0 16px #FF003C;
}
</style>
</head>
<body>
<div class="content">
  <div class="signal-bar"></div>
  <div class="signal-bar2"></div>
  <div class="badge">FESTIVAL PULSE</div>
  <div class="festival-name">${MOCK_FESTIVAL}</div>
  <div class="sub">SIGNAL / MY SCHEDULE</div>
  <div class="h-line"></div>
  ${rows}
  <div class="footer">
    <div class="footer-url">festivalpulse.app</div>
    <div class="footer-rec"></div>
  </div>
</div>
</body>
</html>`
}

// ─── Style 4: Typographic Density ────────────────────────────────────────────

function style4_typo(): string {
  const HEADLINERS = ['Surgeon', 'DVS1', 'Speedy J']
  const rows = MOCK_SETS.map(s => {
    const isHead = HEADLINERS.includes(s.artist)
    return `<div class="artist ${isHead ? 'head' : 'reg'}">${s.artist.toUpperCase()}</div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #FFFFFF;
  font-family: 'Barlow Condensed', sans-serif;
}
.content {
  padding: 90px 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.top-rule {
  width: 100%; height: 8px;
  background: #000;
  margin-bottom: 40px;
}
.festival {
  font-weight: 900;
  font-size: 192px;
  line-height: 0.85;
  letter-spacing: -6px;
  color: #000;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.mid-rule {
  width: 100%; height: 4px;
  background: #000;
  margin: 24px 0;
}
.schedule-label {
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 24px;
  letter-spacing: 5px;
  color: #000;
  text-transform: uppercase;
  margin-bottom: 32px;
}
.artist.head {
  font-weight: 900;
  font-size: 120px;
  line-height: 0.88;
  letter-spacing: -3px;
  color: #000;
  text-transform: uppercase;
  border-bottom: 3px solid #000;
  padding-bottom: 8px;
  margin-bottom: 4px;
}
.artist.reg {
  font-weight: 700;
  font-size: 72px;
  line-height: 0.95;
  letter-spacing: -1px;
  color: #000;
  text-transform: uppercase;
  border-bottom: 1px solid #DDD;
  padding-bottom: 6px;
  margin-bottom: 2px;
}
.footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 24px;
  border-top: 4px solid #000;
}
.footer-url {
  font-family: 'Space Mono', monospace;
  font-size: 22px;
  color: #000;
  letter-spacing: 2px;
}
.footer-num {
  font-weight: 900;
  font-size: 80px;
  color: #000;
  line-height: 1;
}
</style>
</head>
<body>
<div class="content">
  <div class="top-rule"></div>
  <div class="festival">${MOCK_FESTIVAL}</div>
  <div class="mid-rule"></div>
  <div class="schedule-label">My Schedule — ${MOCK_SETS.length} Sets</div>
  ${rows}
  <div class="footer">
    <div class="footer-url">festivalpulse.app</div>
    <div class="footer-num">${MOCK_SETS.length}</div>
  </div>
</div>
</body>
</html>`
}

// ─── Style 5: Timeline ────────────────────────────────────────────────────────

function style5_timeline(): string {
  const byDay: Record<string, typeof MOCK_SETS> = {}
  for (const s of MOCK_SETS) {
    if (!byDay[s.day]) byDay[s.day] = []
    byDay[s.day].push(s)
  }

  const days = Object.keys(byDay)
  const DAY_HEIGHT = 560
  const columns = days.map((day, di) => {
    const sets = byDay[day]
    const totalMinutes = 6 * 60
    const startHour = 22

    const blocks = sets.map(s => {
      const [h, m] = s.time.split(':').map(Number)
      const hours = h < startHour ? h + 24 : h
      const mins = (hours - startHour) * 60 + m
      const pct = Math.min(mins / totalMinutes, 0.95)
      return { ...s, pct }
    })

    const dotItems = blocks.map(b => `
      <div class="dot-row" style="top: calc(80px + ${b.pct} * ${DAY_HEIGHT - 80}px)">
        <div class="dot"></div>
        <div class="dot-label">
          <span class="dot-time">${b.time}</span>
          <span class="dot-artist">${b.artist.toUpperCase()}</span>
        </div>
      </div>
    `).join('')

    return `
      <div class="day-col" style="left: ${100 + di * 290}px">
        <div class="day-label">${day}</div>
        <div class="timeline-track">
          <div class="track-line"></div>
          ${dotItems}
        </div>
      </div>
    `
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #0A0A0A;
  font-family: 'Space Mono', monospace;
}
.content {
  padding: 100px 80px 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.badge {
  font-size: 24px;
  letter-spacing: 6px;
  color: #CCFF00;
  margin-bottom: 16px;
}
.festival-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 900;
  font-size: 130px;
  line-height: 0.88;
  letter-spacing: -3px;
  color: #FFFFFF;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.sub {
  font-size: 26px;
  letter-spacing: 4px;
  color: #444;
  margin-bottom: 80px;
}
.timeline-area {
  position: relative;
  flex: 1;
}
.day-col {
  position: absolute;
  top: 0;
  width: 260px;
}
.day-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 48px;
  letter-spacing: 3px;
  color: #CCFF00;
  margin-bottom: 24px;
  border-bottom: 2px solid #CCFF00;
  padding-bottom: 12px;
}
.timeline-track {
  position: relative;
  height: ${560}px;
}
.track-line {
  position: absolute;
  left: 8px; top: 0; bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, #CCFF00, #1A1A1A);
}
.dot-row {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}
.dot {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #CCFF00;
  flex-shrink: 0;
  box-shadow: 0 0 8px #CCFF00;
}
.dot-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dot-time {
  font-size: 20px;
  color: #555;
  letter-spacing: 1px;
}
.dot-artist {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 40px;
  color: #FFFFFF;
  letter-spacing: 1px;
  line-height: 1;
  white-space: nowrap;
}
.footer {
  margin-top: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid #222;
}
.footer-url {
  font-size: 22px;
  color: #444;
  letter-spacing: 3px;
}
.footer-count {
  font-size: 22px;
  color: #CCFF00;
  letter-spacing: 2px;
}
</style>
</head>
<body>
<div class="content">
  <div class="badge">FESTIVAL PULSE</div>
  <div class="festival-name">${MOCK_FESTIVAL}</div>
  <div class="sub">MY SCHEDULE</div>
  <div class="timeline-area">
    ${columns}
  </div>
  <div class="footer">
    <div class="footer-url">festivalpulse.app</div>
    <div class="footer-count">${MOCK_SETS.length} SETS</div>
  </div>
</div>
</body>
</html>`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STYLES = [
  { id: 'style1-poster',     html: style1_poster() },
  { id: 'style2-ticket',     html: style2_ticket() },
  { id: 'style3-glitch',     html: style3_glitch() },
  { id: 'style4-typography', html: style4_typo() },
  { id: 'style5-timeline',   html: style5_timeline() },
]

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1080, height: 1920 })

  for (const style of STYLES) {
    console.log(`Rendering ${style.id}…`)
    await page.setContent(style.html, { waitUntil: 'networkidle' })
    const outPath = path.join(OUT_DIR, `${style.id}.png`)
    await page.screenshot({ path: outPath, fullPage: false })
    console.log(`  → ${outPath}`)
  }

  await browser.close()
  console.log('\nDone. Previews saved to style-previews/')
}

main().catch(err => { console.error(err); process.exit(1) })
