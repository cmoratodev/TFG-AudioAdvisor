import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

/**
 * Shared chrome for every transactional email so verification, password-reset
 * and any future template look like part of the same brand. Mirrors the dark
 * `AuthShell` / Footer palette: zinc-950 surface, violet-600 accent, Geist-
 * adjacent sans-serif stack (custom fonts aren't worth the bytes in email).
 *
 * Email rendering quirks worth knowing:
 *   - Gmail strips <head><style>, so all styling has to live inline.
 *   - Outlook desktop ignores `padding` on `<body>` — wrap in a Container.
 *   - Dark mode is per-client and unreliable; we just ship dark always.
 */

export interface EmailLayoutProps {
  preview: string
  children: ReactNode
}

const main = {
  backgroundColor: '#09090b', // zinc-950
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '32px 0',
  color: '#e4e4e7', // zinc-200
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  background: 'linear-gradient(to bottom, #18181b 0%, #09090b 100%)',
  borderRadius: '20px',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '40px 36px',
}

const brand = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: '#a78bfa', // violet-400
  margin: '0 0 24px 0',
}

const footerText = {
  fontSize: '12px',
  color: '#71717a', // zinc-500
  lineHeight: '20px',
  margin: 0,
}

const divider = {
  borderColor: 'rgba(255,255,255,0.08)',
  margin: '32px 0 20px 0',
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Audio Advisor</Text>
          {children}
          <Hr style={divider} />
          <Text style={footerText}>
            Si no fuiste tú quien generó este correo, puedes ignorarlo de forma segura. Nadie ha
            entrado en tu cuenta.
          </Text>
          <Text style={{ ...footerText, marginTop: '8px' }}>
            Audio Advisor · TFG · Plataforma de feedback técnico para productores.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ── Building blocks reused across templates ─────────────────────────────────

export const emailHeading = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: '34px',
  color: '#ffffff',
  margin: '0 0 12px 0',
  letterSpacing: '-0.01em',
}

export const emailParagraph = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#d4d4d8', // zinc-300
  margin: '0 0 16px 0',
}

export const emailButtonSection = { textAlign: 'left' as const, margin: '28px 0 8px 0' }

export const emailButton = {
  backgroundColor: '#7c3aed', // violet-600
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '14px',
  padding: '12px 22px',
  borderRadius: '9999px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const emailSubtleLink = {
  color: '#a78bfa', // violet-400
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

export const emailLabel = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: '#71717a', // zinc-500
  margin: '24px 0 6px 0',
}

export { Heading, Link, Section, Text }
