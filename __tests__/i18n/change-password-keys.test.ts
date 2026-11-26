// Mọi key t() trong app/profile/change-password.tsx phải có ở CẢ i18n/vi và
// i18n/en (namespace 'profile'). Lỗi cũ: màn gọi t('changePassword.title')
// trong khi key thật nằm ở profile.changePassword.title → hiện chữ thô.

import fs from 'fs'
import path from 'path'

import en from '@/i18n/en/profile.json'
import vi from '@/i18n/vi/profile.json'

const source = fs.readFileSync(
  path.join(__dirname, '../../app/profile/change-password.tsx'),
  'utf8',
)

const usedKeys = Array.from(
  source.matchAll(/\bt\(\s*'([^']+)'/g),
  (match) => match[1],
)

function lookup(dict: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      dict,
    )
}

describe('app/profile/change-password.tsx — key i18n', () => {
  it('màn dùng namespace profile', () => {
    expect(source).toMatch(/useTranslation\(\s*'profile'\s*\)/)
  })

  it('tìm được các key t() trong màn', () => {
    expect(usedKeys.length).toBeGreaterThan(0)
  })

  it.each([
    ['vi', vi],
    ['en', en],
  ])('mọi key đều có chuỗi trong i18n/%s/profile.json', (_lang, dict) => {
    const missing = usedKeys.filter(
      (key) => typeof lookup(dict, key) !== 'string',
    )
    expect(missing).toEqual([])
  })
})
