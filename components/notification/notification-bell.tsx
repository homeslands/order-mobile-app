/**
 * NotificationBell — bell icon with unread badge count.
 *
 * Subscribes to notification store unread count (atomic selector).
 * Pressable → navigates to notification list screen.
 */
import { Bell } from 'lucide-react-native'
import React, { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { useNotificationStore } from '@/stores/notification.store'

export const NotificationBell = memo(function NotificationBell({
  color,
  size = 22,
}: {
  color: string
  size?: number
}) {
  const unreadCount = useNotificationStore((s) => {
    let count = 0
    for (const n of s.notifications) if (!n.isRead) count++
    return count
  })

  const handlePress = useCallback(() => {
    navigateNative.push(
      '/notification' as Parameters<typeof navigateNative.push>[0],
    )
  }, [])

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={s.container}>
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  )
})

const s = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
})
