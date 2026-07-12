/**
 * analytics.js — MediFind event tracking
 *
 * Fires GA4 custom events AND logs to Supabase tables for the
 * Admin Dashboard live charts.
 *
 * GA4 events:
 *   medicine_search  { query, result_count }
 *   medicine_scan    { medicine_name, confidence, matched }
 */
import { supabase } from './supabase'

// ── Safe gtag wrapper ──────────────────────────────────────
// gtag is loaded asynchronously from Google's CDN. We guard
// every call so nothing breaks if the script hasn't loaded yet.
function gtag(...args) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

// ── trackSearch ────────────────────────────────────────────
/**
 * Call this when a user performs a medicine search.
 * @param {string} query       — the search term
 * @param {number} resultCount — number of results shown
 */
export async function trackSearch(query, resultCount) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return

  // 1. Fire GA4 event
  gtag('event', 'medicine_search', {
    search_term:  q,
    result_count: resultCount,
  })

  // 2. Log to Supabase (fire-and-forget — errors are intentionally swallowed)
  try {
    await supabase.from('search_logs').insert({
      query:        q,
      result_count: resultCount,
    })
  } catch {
    // Non-fatal — analytics logging must never break the UI
  }
}

// ── trackScan ──────────────────────────────────────────────
/**
 * Call this after a successful camera scan.
 * @param {string}  medicineName — AI-identified medicine name
 * @param {number}  confidence   — AI confidence score 0–1
 * @param {boolean} matched      — whether we found it in inventory
 */
export async function trackScan(medicineName, confidence, matched) {
  const name = (medicineName ?? '').trim()
  if (!name) return

  // 1. Fire GA4 event
  gtag('event', 'medicine_scan', {
    medicine_name: name,
    confidence:    Math.round((confidence ?? 0) * 100),
    matched:       Boolean(matched),
  })

  // 2. Log to Supabase
  try {
    await supabase.from('scan_logs').insert({
      medicine_name: name,
      confidence:    confidence ?? 0,
      matched:       Boolean(matched),
    })
  } catch {
    // Non-fatal
  }
}
