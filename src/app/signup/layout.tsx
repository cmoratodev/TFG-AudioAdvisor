import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Empieza a recibir feedback técnico en tus pistas. Crea tu cuenta gratis en Audio Advisor.',
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
