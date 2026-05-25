import * as cheerio from 'cheerio'
import { chromium, type Browser } from 'playwright'

let _browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true })
  }
  return _browser
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

export async function fetchWithCheerio(url: string): Promise<cheerio.CheerioAPI> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const html = await res.text()
  return cheerio.load(html)
}

export async function fetchWithBrowser(url: string): Promise<cheerio.CheerioAPI> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    const html = await page.content()
    return cheerio.load(html)
  } finally {
    await page.close()
  }
}

export function parseTimeRange(text: string): { start_time: string; end_time: string } | null {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  if (!match) return null
  return {
    start_time: match[1].padStart(5, '0'),
    end_time: match[2].padStart(5, '0'),
  }
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
