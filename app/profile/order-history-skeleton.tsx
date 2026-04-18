import React, { memo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { ScreenContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui'

interface OrderHistorySkeletonProps {
  screenBg: string
  headerBg: string
  headerBorder: string
}

function OrderHistorySkeletonComponent({
  screenBg,
  headerBg,
  headerBorder,
}: OrderHistorySkeletonProps) {
  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      style={[styles.flex, { backgroundColor: screenBg }]}
    >
      <View
        style={[
          styles.headerBar,
          { backgroundColor: headerBg, borderBottomColor: headerBorder },
        ]}
      >
        <Skeleton
          style={{ width: 24, height: 24, borderRadius: 12, marginRight: 12 }}
        />
        <Skeleton style={{ width: 160, height: 20, borderRadius: 6 }} />
      </View>
      <ScrollView contentContainerStyle={styles.listPadding}>
        {SKELETON_KEYS.map((key) => (
          <View
            key={key}
            style={[
              styles.skeletonCard,
              { backgroundColor: headerBg, borderColor: headerBorder },
            ]}
          >
            <View style={styles.skeletonHeaderRow}>
              <Skeleton style={{ width: 128, height: 12, borderRadius: 6 }} />
              <Skeleton style={{ width: 96, height: 24, borderRadius: 12 }} />
            </View>
            <View style={styles.skeletonItemRow}>
              <Skeleton style={{ width: 64, height: 64, borderRadius: 8 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton style={{ width: 160, height: 16, borderRadius: 6 }} />
                <Skeleton style={{ width: 96, height: 12, borderRadius: 6 }} />
                <Skeleton style={{ width: 112, height: 16, borderRadius: 6 }} />
              </View>
            </View>
            <View
              style={[styles.skeletonSummary, { borderTopColor: headerBorder }]}
            >
              <View style={styles.skeletonSummaryRow}>
                <Skeleton style={{ width: 96, height: 12, borderRadius: 6 }} />
                <Skeleton style={{ width: 80, height: 12, borderRadius: 6 }} />
              </View>
              <View style={styles.skeletonSummaryRow}>
                <Skeleton style={{ width: 112, height: 16, borderRadius: 6 }} />
                <Skeleton style={{ width: 96, height: 16, borderRadius: 6 }} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  )
}

const SKELETON_KEYS = [1, 2, 3]

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listPadding: { paddingHorizontal: 16, paddingTop: 130, paddingBottom: 24 },
  skeletonCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  skeletonItemRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  skeletonSummary: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  skeletonSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
})

export const OrderHistorySkeleton = memo(OrderHistorySkeletonComponent)
