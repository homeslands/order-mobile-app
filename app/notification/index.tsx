/**
 * Notification List Screen — paginated, pull-to-refresh, tab filter.
 */
import { FlashList } from '@shopify/flash-list'
import { Bell } from 'lucide-react-native'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'

import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import { colors } from '@/constants'
import { NOTIFICATION_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { NotificationMessageCode } from '@/constants/notification.constant'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useMarkNotificationAsRead, useNotifications } from '@/hooks/use-notification'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'
import type { INotification } from '@/types/notification.type'

// ─── Notification helpers ────────────────────────────────────────────────────

type TFn = (key: string, opts?: Record<string, unknown>) => string

function getNotificationTitle(message: string, t: TFn): string {
  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_PROCESSED: return t('titleOrderNeedsProcessed')
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED: return t('titleOrderNeedsDelivered')
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET: return t('titleOrderNeedsReadyToGet')
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED: return t('titleOrderNeedsCancelled')
    case NotificationMessageCode.ORDER_BILL_FAILED_PRINTING: return t('titleOrderBillFailedPrinting')
    case NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING: return t('titleOrderChefOrderFailedPrinting')
    case NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING: return t('titleOrderLabelTicketFailedPrinting')
    case NotificationMessageCode.ORDER_PAID: return t('titleOrderPaid')
    case NotificationMessageCode.CARD_ORDER_PAID: return t('titleCardOrderPaid')
    default: return message || t('titleDefault')
  }
}

function getNotificationBody(message: string, orderSlug: string, t: TFn): string {
  const ref = orderSlug ? `#${orderSlug}` : ''
  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_PROCESSED:
      return t('bodyOrderNeedsProcessed', { ref })
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED:
      return t('bodyOrderNeedsDelivered', { ref })
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET:
      return t('bodyOrderNeedsReadyToGet', { ref })
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED:
      return t('bodyOrderNeedsCancelled', { ref })
    case NotificationMessageCode.ORDER_BILL_FAILED_PRINTING:
      return t('bodyOrderBillFailedPrinting', { ref })
    case NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING:
      return t('bodyOrderChefOrderFailedPrinting', { ref })
    case NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING:
      return t('bodyOrderLabelTicketFailedPrinting', { ref })
    case NotificationMessageCode.ORDER_PAID:
    case NotificationMessageCode.CARD_ORDER_PAID:
      return t('bodyOrderPaid', { ref })
    default:
      return ''
  }
}

function formatTimeAgo(createdAt: string, t: TFn): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('timeJustNow')
  if (mins < 60) return t('timeMinutesAgo', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('timeHoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('timeDaysAgo', { count: days })
}

// ─── Skeleton item ───────────────────────────────────────────────────────────

const NotificationSkeletonItem = memo(function NotificationSkeletonItem() {
  return (
    <View style={ns.itemContainer}>
      <View style={ns.itemInner}>
        <Skeleton className="w-10 h-10 rounded-xl" />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton className="h-3.5 rounded w-2/3" />
          <Skeleton className="h-3 rounded w-full" />
          <Skeleton className="h-3 rounded w-1/4" />
        </View>
      </View>
    </View>
  )
})

// ─── NotificationItem ────────────────────────────────────────────────────────

const NotificationItem = memo(function NotificationItem({
  item,
  isDark,
  primaryColor,
  onMarkRead,
}: {
  item: INotification
  isDark: boolean
  primaryColor: string
  onMarkRead: (slug: string) => void
}) {
  const { t } = useTranslation('notification')

  const handlePress = useCallback(() => {
    onMarkRead(item.slug)
    const orderSlug = item.metadata?.order
    if (orderSlug) {
      navigateNative.push({ pathname: '/order/[id]', params: { id: orderSlug } })
    }
  }, [item.slug, item.metadata?.order, onMarkRead])

  const title = useMemo(() => getNotificationTitle(item.message, t), [item.message, t])
  const orderSlug = item.metadata?.order ?? ''
  const body = useMemo(
    () => getNotificationBody(item.message, orderSlug, t),
    [item.message, orderSlug, t],
  )
  const timeAgo = useMemo(() => formatTimeAgo(item.createdAt, t), [item.createdAt, t])

  const cardBg = item.isRead
    ? (isDark ? colors.gray[900] : '#fff')
    : (isDark ? `${primaryColor}18` : `${primaryColor}12`)

  return (
    <Pressable
      onPress={handlePress}
      style={[
        ns.itemContainer,
        {
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: !item.isRead
            ? `${primaryColor}40`
            : (isDark ? colors.gray[800] : colors.gray[200]),
        },
      ]}
    >
      <View style={ns.itemInner}>
        <View style={[ns.iconWrap, { backgroundColor: primaryColor }]}>
          <Bell size={18} color="#fff" />
        </View>
        <View style={ns.itemContent}>
          <Text
            style={[
              ns.itemTitle,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
              !item.isRead && ns.itemTitleUnread,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {!!body && (
            <Text
              style={[ns.itemBody, { color: isDark ? colors.gray[400] : colors.gray[500] }]}
              numberOfLines={2}
            >
              {body}
            </Text>
          )}
          <View style={ns.itemBottomRow}>
            <Text style={[ns.itemTime, { color: isDark ? colors.gray[500] : colors.gray[400] }]}>
              {timeAgo}
            </Text>
            {!item.isRead && (
              <Text style={[ns.statusLabel, { color: primaryColor }]}>
                {t('statusUnread')}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  )
})

// ─── Tab header ──────────────────────────────────────────────────────────────

const NotificationTabHeader = memo(function NotificationTabHeader({
  activeTab,
  unreadCount,
  isDark,
  primaryColor,
  onTabChange,
}: {
  activeTab: 'all' | 'unread'
  unreadCount: number
  isDark: boolean
  primaryColor: string
  onTabChange: (tab: 'all' | 'unread') => void
}) {
  const { t } = useTranslation('notification')
  const inactiveBg = isDark ? colors.gray[800] : '#fff'
  const inactiveText = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <View style={ns.tabs}>
      <Pressable
        style={[ns.tab, { backgroundColor: activeTab === 'all' ? primaryColor : inactiveBg }]}
        onPress={() => onTabChange('all')}
      >
        <Text style={[ns.tabText, { color: activeTab === 'all' ? '#fff' : inactiveText }]}>
          {t('tabAll')}
        </Text>
      </Pressable>
      <Pressable
        style={[ns.tab, { backgroundColor: activeTab === 'unread' ? primaryColor : inactiveBg }]}
        onPress={() => onTabChange('unread')}
      >
        <Text style={[ns.tabText, { color: activeTab === 'unread' ? '#fff' : inactiveText }]}>
          {unreadCount > 0 ? t('tabUnreadCount', { count: unreadCount }) : t('tabUnread')}
        </Text>
      </Pressable>
    </View>
  )
})

// ─── Screen ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export default function NotificationScreen() {
  const { t } = useTranslation('notification')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const screenBg = isDark ? colors.background.dark : colors.background.light

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.isRead).length,
  )
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  // ── Tab filter ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const displayedNotifications = useMemo(
    () => activeTab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications,
    [activeTab, notifications],
  )

  // ── Pagination ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const { data: apiData, isRefetching, isFetching, refetch } = useNotifications(
    { receiver: userSlug, page, size: PAGE_SIZE },
    { enabled: !!userSlug },
  )
  const hasMore = apiData?.result?.hasNext ?? true
  const loadingMore = isFetching && page > 1
  const isFirstLoad = isFetching && page === 1 && notifications.length === 0

  useEffect(() => {
    const items = apiData?.result?.items
    if (items && items.length > 0) {
      useNotificationStore.getState().hydrateFromApi(items)
    }
  }, [apiData])

  const handleRefresh = useCallback(() => {
    setPage(1)
    refetch()
  }, [refetch])

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isFetching) return
    setPage((p) => p + 1)
  }, [hasMore, isFetching])

  // ── Mark as read ────────────────────────────────────────────────────────
  const { mutate: markReadApi } = useMarkNotificationAsRead()
  const handleMarkRead = useCallback((slug: string) => { markReadApi(slug) }, [markReadApi])

  // ── Render helpers ──────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: INotification }) => (
      <NotificationItem
        item={item}
        isDark={isDark}
        primaryColor={primaryColor}
        onMarkRead={handleMarkRead}
      />
    ),
    [isDark, primaryColor, handleMarkRead],
  )

  const keyExtractor = useCallback((item: INotification) => item.slug, [])

  const handleTabChange = useCallback((tab: 'all' | 'unread') => setActiveTab(tab), [])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => { layout.size = NOTIFICATION_ITEM_HEIGHT },
    [],
  )

  const ListEmptyComponent = useMemo(
    () =>
      isFirstLoad ? null : (
        <View style={ns.emptyWrap}>
          <Bell size={56} color={isDark ? colors.gray[600] : colors.gray[300]} />
          <Text style={[ns.emptyTitle, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
            {activeTab === 'unread' ? t('emptyUnreadTitle') : t('emptyTitle')}
          </Text>
          <Text style={[ns.emptyDesc, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
            {activeTab === 'unread' ? t('emptyUnreadDesc') : t('emptyDesc')}
          </Text>
        </View>
      ),
    [isDark, isFirstLoad, activeTab, t],
  )

  const ListFooterComponent = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={ns.loadingMore}>
          <ActivityIndicator size="small" color={primaryColor} />
        </View>
      )
    }
    return null
  }, [loadingMore, primaryColor])

  return (
    <View style={[ns.flex, { backgroundColor: screenBg }]}>
      {isFirstLoad ? (
        <View style={ns.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <NotificationSkeletonItem key={i} />
          ))}
        </View>
      ) : (
        <FlashList
          data={displayedNotifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={overrideItemLayout}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
          contentContainerStyle={ns.listPadding}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        />
      )}

      {/* Fixed tab bar — transparent, nằm trong vùng gradient của FloatingHeader */}
      <View style={[ns.tabsFixed, { top: STATIC_TOP_INSET + 52 }]} pointerEvents="box-none">
        <NotificationTabHeader
          activeTab={activeTab}
          unreadCount={unreadCount}
          isDark={isDark}
          primaryColor={primaryColor}
          onTabChange={handleTabChange}
        />
      </View>

      <FloatingHeader title={t('title')} disableBlur />
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const TAB_BAR_TOP = STATIC_TOP_INSET + 52
const LIST_PADDING_TOP = TAB_BAR_TOP + 52

const ns = StyleSheet.create({
  flex: { flex: 1 },
  listPadding: { paddingTop: LIST_PADDING_TOP, paddingBottom: 32, paddingHorizontal: 16 },
  skeletonList: { paddingTop: LIST_PADDING_TOP, paddingHorizontal: 16, gap: 8 },

  // Fixed tab bar
  tabsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Item
  itemContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 8,
  },
  itemInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 14, lineHeight: 20 },
  itemTitleUnread: { fontWeight: '700' },
  itemBody: { fontSize: 13, lineHeight: 18 },
  itemBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  itemTime: { fontSize: 11 },
  statusLabel: { fontSize: 11, fontWeight: '600' },

  // Helpers
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '600' },
  emptyDesc: { marginTop: 6, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
