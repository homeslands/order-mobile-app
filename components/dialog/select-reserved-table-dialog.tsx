import { TriangleAlert } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
} from '@/components/ui'

import { ITable } from '@/types'

interface SelectReservedTableDialogProps {
  table: ITable | null
  setSelectedTableId?: React.Dispatch<React.SetStateAction<string | undefined>>
  onConfirm: (table: ITable) => void
  onCancel: () => void
}

export default function SelectReservedTableDialog({
  table,
  onConfirm,
  onCancel,
}: SelectReservedTableDialogProps) {
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation('common')

  if (!table) return null

  return (
    <Dialog open={!!table} onOpenChange={onCancel}>
      <Dialog.Content className="max-w-[22rem] rounded-md sm:max-w-[32rem]">
        <Dialog.Header>
          <Dialog.Title className="pb-4 border-b border-destructive text-destructive">
            <div className="flex items-center gap-2">
              <TriangleAlert className="w-6 h-6" />
              {t('menu.tableNote')}
            </div>
          </Dialog.Title>
          <div className="py-4 text-sm text-muted-foreground">
            {t('menu.selectReservedTableWarning')}{' '}
            <span className="font-bold">{table?.name}</span>
            {t('menu.selectReservedTableWarning2')}
          </div>
        </Dialog.Header>
        <Dialog.Footer className="flex flex-row justify-center gap-2">
          <Button variant="outline" onPress={onCancel}>
            {tCommon('common.cancel')}
          </Button>
          <Button variant="destructive" onPress={() => onConfirm(table)}>
            {t('menu.confirmSelectTable')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
