import { useTranslation } from 'react-i18next'

import { NoteInput } from './note-input'

interface OrderNoteInputProps {
  value?: string
  onChange: (text: string) => void
  onBlur?: () => void
}

// Presentational component only: UI + i18n, không truy cập store
export default function OrderNoteInput({
  value,
  onChange,
  onBlur,
}: OrderNoteInputProps) {
  const { t } = useTranslation('menu')

  return (
    <NoteInput
      value={value}
      placeholder={t('order.enterOrderNote')}
      onChange={onChange}
      onBlur={onBlur}
    />
  )
}
