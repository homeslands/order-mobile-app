import { useTranslation } from 'react-i18next'

import { NoteInput } from './note-input'

interface CartNoteInputProps {
  value?: string
  onChange: (text: string) => void
}

// Presentational component only: UI + i18n, không truy cập store
export default function CartNoteInput({ value, onChange }: CartNoteInputProps) {
  const { t } = useTranslation('menu')

  return (
    <NoteInput
      value={value}
      placeholder={t('order.enterNote')}
      onChange={onChange}
    />
  )
}
