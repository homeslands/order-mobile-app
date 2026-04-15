import React from 'react'
import { View } from 'react-native'

import { Button, Dialog } from '@/components/ui'

export interface ConfirmationDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  content?: React.ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  variant?: 'destructive' | 'default'
  icon?: React.ReactNode
  alignButtons?: 'start' | 'center' | 'end'
  titleClassName?: string
  descriptionClassName?: string
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  content,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'destructive',
  icon,
  alignButtons = 'end',
  titleClassName,
  descriptionClassName,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const defaultTitleClassName = variant === 'destructive' 
    ? 'text-destructive flex items-center gap-2' 
    : 'flex items-center gap-2'

  const defaultDescriptionClassName = variant === 'destructive'
    ? 'p-2 bg-red-100 rounded-md dark:bg-red-900/30 text-destructive'
    : 'mt-2 text-muted-foreground'

  const buttonAlignment = 
    alignButtons === 'center' ? 'justify-center' : 
    alignButtons === 'start' ? 'justify-start' : 
    'justify-end'

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <Dialog.Header>
          <Dialog.Title className={titleClassName || defaultTitleClassName}>
            {icon}
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className={descriptionClassName || defaultDescriptionClassName}>
              {description}
            </Dialog.Description>
          )}
        </Dialog.Header>

        {content && (
          <View className="mt-4">
            {content}
          </View>
        )}

        <Dialog.Footer className={`flex flex-row gap-2 ${buttonAlignment}`}>
          <Button variant="outline" onPress={handleCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onPress={handleConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}

