import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'

import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'

export default function AccountSettingsPlaceholder() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <ScreenContainer edges={['top']} className="flex-1">
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? colors.card.dark : colors.card.light,
            borderBottomColor: isDark
              ? colors.border.dark
              : colors.border.light,
          },
        ]}
      >
        <Pressable style={styles.backHitSlop} onPress={() => router.back()}>
          <Text style={[styles.backLabel, { color: textColor }]}>{'‹'}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Cài đặt tài khoản
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={styles.center}>
        <Text style={[styles.title, { color: textColor }]}>
          Cài đặt tài khoản
        </Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>
          Trang rỗng để kiểm tra transition hãm phanh.
        </Text>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backHitSlop: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 24,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightSpacer: {
    width: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
})
