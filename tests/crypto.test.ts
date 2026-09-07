import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  decryptToken,
  encryptToken,
  equalTokens,
  hashToken,
} from '../src/lib/crypto.server'

describe('OAuth token storage', () => {
  const key = randomBytes(32).toString('hex')
  it('encrypts with a unique nonce, roundtrips, and keeps plaintext out of storage', () => {
    const token = 'example-token-used-only-in-tests'
    const first = encryptToken(token, key)
    expect(first).not.toContain(token)
    expect(first).not.toBe(encryptToken(token, key))
    expect(decryptToken(first, key)).toBe(token)
  })
  it('rejects tampered ciphertext and a different key', () => {
    const encrypted = encryptToken('test-token', key)
    const parts = encrypted.split('.')
    const ciphertext = Buffer.from(parts[3], 'base64url')
    ciphertext[0] ^= 1
    parts[3] = ciphertext.toString('base64url')
    expect(() => decryptToken(parts.join('.'), key)).toThrow()
    expect(() =>
      decryptToken(encrypted, randomBytes(32).toString('hex')),
    ).toThrow()
  })
  it('compares state values exactly and stores only a hash of session tokens', () => {
    expect(equalTokens('expected-state', 'expected-state')).toBe(true)
    expect(equalTokens('expected-state', 'bad')).toBe(false)
    expect(equalTokens('expected-state', 'tampered-state')).toBe(false)
    expect(hashToken('session-token')).toHaveLength(64)
  })
})
