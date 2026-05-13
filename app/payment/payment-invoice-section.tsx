import { FileDown } from 'lucide-react-native'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { InvoiceTemplate } from '@/components/profile'
import { colors } from '@/constants'
import { useExportPublicOrderInvoice, useOrderBySlug } from '@/hooks'
import { OrderStatus } from '@/types'
import { downloadAndSavePDF, showToast } from '@/utils'

export const InvoiceSection = memo(function InvoiceSection({
  order,
  primaryColor,
  isDark,
}: {
  order: NonNullable<ReturnType<typeof useOrderBySlug>['data']>['result']
  primaryColor: string
  isDark: boolean
}) {
  const { t: tCommon } = useTranslation('common')
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const { mutate: exportInvoice, isPending: isExportingInvoice } =
    useExportPublicOrderInvoice()
  const [isSaving, setIsSaving] = useState(false)

  const isLoading = isExportingInvoice || isSaving

  const handleDownload = useCallback(() => {
    if (!order?.slug || isLoading) return
    const slug = order.slug
    setIsSaving(true)
    exportInvoice(slug, {
      onSuccess: async (data) => {
        const name = `TRENDCoffee-invoice-${slug}-${Date.now()}`
        try {
          await downloadAndSavePDF(data, name)
          showToast(tCommon('common.downloadSuccess'))
        } catch {
          showToast(tToast('toast.invoiceExportError'), 'error')
        } finally {
          setIsSaving(false)
        }
      },
      onError: () => {
        setIsSaving(false)
        showToast(tToast('toast.invoiceExportError'))
      },
    })
  }, [order?.slug, isLoading, exportInvoice, tCommon, tToast])

  if (!order || order.status !== OrderStatus.PAID) return null

  return (
    <View style={invoiceStyles.invoiceSection}>
      <Text
        style={[
          invoiceStyles.invoiceTitle,
          { color: isDark ? colors.gray[400] : colors.gray[600] },
        ]}
      >
        {t('order.invoice')}
      </Text>
      <InvoiceTemplate order={order} />
      <Pressable
        onPress={handleDownload}
        disabled={isLoading}
        style={[
          invoiceStyles.downloadBtn,
          { backgroundColor: isLoading ? colors.gray[400] : primaryColor },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.white.light} />
        ) : (
          <FileDown size={18} color={colors.white.light} />
        )}
        <Text style={invoiceStyles.downloadBtnText}>
          {isLoading
            ? tCommon('common.downloading')
            : tCommon('common.downloadPDF')}
        </Text>
      </Pressable>
    </View>
  )
})

export const invoiceStyles = StyleSheet.create({
  invoiceSection: { marginBottom: 16 },
  invoiceTitle: { fontSize: 18, textAlign: 'center', marginBottom: 16 },
  downloadBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white.light,
  },
})
