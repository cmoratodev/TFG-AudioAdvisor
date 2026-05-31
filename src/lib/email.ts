import 'server-only'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

declare global {
  var resendGlobal: Resend | undefined
}

/**
 * Lazily-built Resend client. We keep a single instance per Node process so
 * the SDK's internal HTTP keep-alive can do its thing across calls.
 *
 * Throws at first use (not at import time) if the env var is missing, so a
 * misconfigured environment fails loud on the first `sendEmail()` call
 * instead of crashing the whole server boot.
 */
function getClient(): Resend {
  if (globalThis.resendGlobal) return globalThis.resendGlobal
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to .env.local — see .env.example for the layout.',
    )
  }
  const client = new Resend(key)
  if (process.env.NODE_ENV !== 'production') {
    globalThis.resendGlobal = client
  }
  return client
}

interface SendEmailArgs {
  to: string
  subject: string
  /** React Email template element. Rendered to HTML + plaintext fallback. */
  template: ReactElement
}

/**
 * Send a transactional email through Resend.
 *
 * The template is a React Email component — we render it to both HTML
 * (rich client) and plain text (fallback for accessibility / spam filters)
 * before handing the payload to Resend.
 *
 * Failures are surfaced to the caller; routes that send mail should treat a
 * mail failure as non-fatal where possible (e.g. signup succeeds even if
 * the verification email bounces, the user can request a resend).
 */
export async function sendEmail({ to, subject, template }: SendEmailArgs): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'Audio Advisor <onboarding@resend.dev>'
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ])
  const { error } = await getClient().emails.send({
    from,
    to,
    subject,
    html,
    text,
  })
  if (error) {
    console.error('[email] Resend rejected the send:', error)
    throw new Error(error.message ?? 'Resend send failed')
  }
}

/** Resolves the canonical app URL for building absolute links in emails. */
export function appBaseUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://localhost:3000'
}
