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
  /** Display name shown in the greeting. */
  name: string
  /** Absolute URL the user clicks to verify their account. */
  verifyUrl: string
}

export function VerifyEmail({ name, verifyUrl }: Props) {
  return (
    <EmailLayout preview="Confirma tu cuenta en Audio Advisor">
      <Text style={emailHeading}>
        Hola {name}, vamos a confirmar tu cuenta.
      </Text>
      <Text style={emailParagraph}>
        Pulsa el botón para verificar tu correo. Así sabemos que eres tú quien se ha registrado y
        evitamos cuentas duplicadas.
      </Text>

      <Section style={emailButtonSection}>
        <Link href={verifyUrl} style={emailButton}>
          Verificar mi cuenta
        </Link>
      </Section>

      <Text style={emailLabel}>¿No funciona el botón?</Text>
      <Text style={{ ...emailParagraph, fontSize: '13px' }}>
        Copia y pega este enlace en tu navegador:
        <br />
        <Link href={verifyUrl} style={emailSubtleLink}>
          {verifyUrl}
        </Link>
      </Text>
    </EmailLayout>
  )
}

export default VerifyEmail
