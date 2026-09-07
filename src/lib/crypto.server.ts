import '@tanstack/react-start/server-only'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export function encryptToken(value: string, key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptToken(value: string, key: string): string {
  const [version, iv, tag, data] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !data)
    throw new Error('Invalid encrypted token.')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export const randomToken = () => randomBytes(32).toString('base64url')
export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex')
export function equalTokens(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
