import { CheckCircle2, Download, FileDown } from 'lucide-react-native'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { InvoiceTemplate } from '@/components/profile'
import { colors } from '@/constants'
import { useExportPublicOrderInvoice, useOrderBySlug } from '@/hooks'
import { useDownloadStore } from '@/stores'
import { OrderStatus } from '@/types'
import { downloadAndSavePDF, showToast } from '@/utils'

export const InvoiceSection = React.memo(function InvoiceSection({
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
  const { mutate: exportInvoice, isPending: isExportingInvoice } = useExportPublicOrderInvoice()
  const { isDownloading, progress, fileName } = useDownloadStore()

  const orderSlugForInvoice = order?.slug
  const handleDownload = useCallback(() => {
    if (!orderSlugForInvoice) return
    exportInvoice(orderSlugForInvoice, {
      onSuccess: async (blob) => {
        const name = `TRENDCoffee-invoice-${orderSlugForInvoice}-${Date.now()}`
        await downloadAndSavePDF(blob, name)
      },
      onError: () => showToast('Lỗi khi xuất hóa đơn'),
    })
  }, [orderSlugForInvoice, exportInvoice])

  if (!order || order.status !== OrderStatus.PAID) return null

  return (
    <View style={invoiceStyles.invoiceSection}>
      <Text style={[invoiceStyles.invoiceTitle, { color: isDark ? colors.gray[400] : colors.gray[600] }]}>{t('order.invoice', 'Hóa đơn')}</Text>
      <InvoiceTemplate order={order} />
      {(isExportingInvoice || isDownloading) && (
        <View style={[invoiceStyles.downloadCard, { backgroundColor: isDark ? colors.gray[900] : '#fff', borderColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
          <View style={invoiceStyles.downloadRow}>
            <View style={[invoiceStyles.downloadIcon, { backgroundColor: `${primaryColor}18` }]}>
              <Download size={20} color={primaryColor} />
            </View>
            <View style={invoiceStyles.flex1}>
              <Text style={[invoiceStyles.smSemibold, { color: isDark ? colors.gray[100] : colors.gray[900] }]}>
                {isExportingInvoice ? tCommon('common.downloadingInvoice', 'Đang tải hóa đơn...') : tCommon('common.savingFile', 'Đang lưu file...')}
              </Text>
              <Text style={[invoiceStyles.xsText, { color: isDark ? colors.gray[400] : colors.gray[500], marginTop: 2 }]}>
                {isExportingInvoice ? tCommon('common.pleaseWait', 'Vui lòng đợi trong giây lát') : tCommon('common.savingToDownloads', 'Đang lưu vào thư mục Downloads')}
              </Text>
            </View>
            {progress > 0 && (
              <View style={[invoiceStyles.progressBadge, { backgroundColor: `${primaryColor}18` }]}>
                <Text style={[invoiceStyles.smBold, { color: primaryColor }]}>{progress}%</Text>
              </View>
            )}
          </View>
          {progress > 0 ? (
            <View style={[invoiceStyles.progressTrack, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
              <View style={[invoiceStyles.progressFill, { width: `${progress}%` as unknown as number, backgroundColor: primaryColor }]} />
            </View>
          ) : (
            <View style={invoiceStyles.processingRow}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={[invoiceStyles.xsText, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>{tCommon('common.processing', 'Đang xử lý...')}</Text>
            </View>
          )}
        </View>
      )}
      {fileName && !isDownloading && !isExportingInvoice && (
        <View style={[invoiceStyles.successCard, { backgroundColor: isDark ? 'rgba(20, 83, 45, 0.2)' : colors.success.bgLight, borderColor: isDark ? colors.success.borderDark : colors.success.borderLight }]}>
          <View style={invoiceStyles.downloadRow}>
            <CheckCircle2 size={24} color={isDark ? colors.success.dark : colors.success.light} />
            <View style={invoiceStyles.flex1}>
              <Text style={[invoiceStyles.smSemibold, { color: isDark ? colors.success.dark : colors.success.borderDark }]}>{tCommon('common.downloadSuccess', 'Đã tải xuống thành công')}</Text>
              <Text style={[invoiceStyles.xsText, { color: isDark ? colors.success.dark : colors.success.iconBgLight, marginTop: 2 }]}>
                {Platform.OS === 'android' ? tCommon('common.fileSavedToDownloads', 'File đã lưu vào thư mục Downloads') : tCommon('common.fileSavedToFilesApp', 'File đã lưu vào Files app')}
              </Text>
            </View>
          </View>
        </View>
      )}
      <Pressable onPress={handleDownload} disabled={isExportingInvoice || isDownloading} style={[invoiceStyles.downloadBtn, { backgroundColor: (isExportingInvoice || isDownloading) ? colors.gray[400] : primaryColor }]}>
        <FileDown size={18} color={colors.white.light} />
        <Text style={invoiceStyles.downloadBtnText}>{(isExportingInvoice || isDownloading) ? tCommon('common.downloading', 'Đang tải...') : tCommon('common.downloadPDF', 'Tải xuống PDF')}</Text>
      </Pressable>
    </View>
  )
})

export const invoiceStyles = StyleSheet.create({
  invoiceSection: { marginBottom: 16 },
  invoiceTitle: { fontSize: 18, textAlign: 'center', marginBottom: 16 },
  downloadCard: { marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  downloadIcon: { padding: 8, borderRadius: 999 },
  flex1: { flex: 1 },
  smSemibold: { fontSize: 14, fontWeight: '600' },
  smBold: { fontSize: 14, fontWeight: '700' },
  xsText: { fontSize: 12 },
  progressBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  successCard: { marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  downloadBtn: { marginTop: 12, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  downloadBtnText: { fontSize: 15, fontWeight: '600', color: colors.white.light },
})
