import { useTranslation } from 'react-i18next'

import { NoteInput } from './note-input'

interface OrderNoteInputProps {
  value?: string
  onChange: (text: string) => void
}

// Presentational component only: UI + i18n, không truy cập store
export default function OrderNoteInput({ value, onChange }: OrderNoteInputProps) {
  const { t } = useTranslation('menu')

  return (
    <NoteInput
      value={value}
      placeholder={t('order.enterOrderNote')}
      onChange={onChange}
    />
  )
}
