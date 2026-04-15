import { VerificationMethod } from '@/constants'

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  const visible = phone.slice(-4)
  return `${'*'.repeat(phone.length - 4)}${visible}`
}

export function maskIdentity(
  value: string,
  method: VerificationMethod,
): string {
  return method === VerificationMethod.EMAIL
    ? maskEmail(value)
    : maskPhone(value)
}
