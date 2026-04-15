import { colors } from '@/constants'
import { LogOut } from 'lucide-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmationDialog } from './confirmation-dialog'

interface LogoutDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLogout: () => void
}

export default function LogoutDialog({
  isOpen,
  onOpenChange,
  onLogout,
}: LogoutDialogProps) {
  const { t } = useTranslation('auth')

  const handleConfirm = () => {
    onLogout()
    onOpenChange(false)
  }

  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('logout.title')}
      description={t('logout.description')}
      confirmLabel={t('logout.logout')}
      cancelLabel={t('logout.cancel')}
      onConfirm={handleConfirm}
      variant="destructive"
      icon={<LogOut size={20} color={colors.destructive.light} />}
      descriptionClassName="mt-2 text-muted-foreground"
    />
  )
}

