import {
  EmailLayout,
  Link,
  Section,
  Text,
  emailButton,
  emailButtonSection,
  emailHeading,
  emailLabel,
  emailParagraph,
  emailSubtleLink,
} from './components'

interface Props {
  name: string
  resetUrl: string
  /** Minutes until the link expires — surfaced in the copy so the user knows
   *  not to leave the email half-read for a day. */
  expiresInMinutes: number
}

export function ResetPassword({ name, resetUrl, expiresInMinutes }: Props) {
  return (
    <EmailLayout preview="Restablece tu contraseña de Audio Advisor">
      <Text style={emailHeading}>Hola {name}, restablece tu contraseña.</Text>
      <Text style={emailParagraph}>
        Has solicitado cambiar tu contraseña. Pulsa el botón para elegir una nueva. El enlace
        caduca en <strong style={{ color: '#ffffff' }}>{expiresInMinutes} minutos</strong>.
      </Text>

      <Section style={emailButtonSection}>
        <Link href={resetUrl} style={emailButton}>
          Restablecer contraseña
        </Link>
      </Section>

      <Text style={emailLabel}>¿No funciona el botón?</Text>
      <Text style={{ ...emailParagraph, fontSize: '13px' }}>
        Copia y pega este enlace en tu navegador:
        <br />
        <Link href={resetUrl} style={emailSubtleLink}>
          {resetUrl}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default ResetPassword
