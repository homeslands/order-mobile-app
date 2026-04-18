import { FlashList } from '@shopify/flash-list'
import dayjs from 'dayjs'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'

import { colors } from '@/constants'
import {
  UPDATE_ORDER_CATALOG_HEADER_HEIGHT,
  UPDATE_ORDER_MENU_ITEM_HEIGHT,
} from '@/constants/list-item-sizes'
import { useCatalog } from '@/hooks'
import { usePublicSpecificMenu, useSpecificMenu } from '@/hooks/use-menu'
import { useAuthStore, useOrderFlowStore } from '@/stores'
import { IMenuItem } from '@/types'

import ClientMenuItemForUpdateOrder from './client-menu-item-for-update-order'

interface UpdateOrderMenusProps {
  branchSlug: string
  primaryColor: string
}

type CatalogHeader = {
  type: 'header'
  catalogSlug: string
  catalogName: string
}
type MenuRow = { type: 'item'; item: IMenuItem }
type FlatListItem = CatalogHeader | MenuRow

export default function UpdateOrderMenus({
  branchSlug,
  primaryColor,
}: UpdateOrderMenusProps) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const { data: catalogs, isPending: isLoadingCatalog } = useCatalog()
  const hasUpdatingData = useOrderFlowStore((s) => s.updatingData !== null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  const menuRequest = useMemo(
    () => ({ branch: branchSlug, date: dayjs().format('YYYY-MM-DD') }),
    [branchSlug],
  )

  const shouldFetchAuth = !!branchSlug && isAuthenticated
  const shouldFetchPublic = !!branchSlug && !isAuthenticated

  const { data: authMenuData, isPending: isLoadingAuthMenu } = useSpecificMenu(
    menuRequest,
    shouldFetchAuth,
  )
  const { data: publicMenuData, isPending: isLoadingPublicMenu } =
    usePublicSpecificMenu(menuRequest, shouldFetchPublic)

  const menuData = isAuthenticated ? authMenuData : publicMenuData
  const isLoadingMenu = isAuthenticated
    ? isLoadingAuthMenu
    : isLoadingPublicMenu

  const menuItems = useMemo(() => {
    const items = menuData?.result?.menuItems
    if (!items) return undefined
    return [...items].sort((a, b) => {
      if (a.isLocked !== b.isLocked)
        return Number(a.isLocked) - Number(b.isLocked)
      const aInStock =
        (a.currentStock !== 0 && a.currentStock !== null) || !a.product.isLimit
      const bInStock =
        (b.currentStock !== 0 && b.currentStock !== null) || !b.product.isLimit
      return Number(bInStock) - Number(aInStock)
    })
  }, [menuData])

  const groupedItems = useMemo(() => {
    const grouped =
      catalogs?.result?.map((catalog) => ({
        catalog,
        items:
          menuItems?.filter(
            (mi) => mi.product.catalog?.slug === catalog.slug,
          ) || [],
      })) || []
    grouped.sort((a, b) => b.items.length - a.items.length)
    return grouped
  }, [catalogs?.result, menuItems])

  const flatListData = useMemo((): FlatListItem[] => {
    const result: FlatListItem[] = []
    for (const group of groupedItems) {
      if (group.items.length === 0) continue
      result.push({
        type: 'header',
        catalogSlug: group.catalog.slug,
        catalogName: group.catalog.name,
      })
      for (const item of group.items) {
        result.push({ type: 'item', item })
      }
    }
    return result
  }, [groupedItems])

  // showImage phase gate — defer heavy decodes
  const [showImage, setShowImage] = useState(false)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShowImage(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const grayColor = isDark ? colors.gray[400] : colors.gray[500]

  const renderItem = useCallback(
    ({ item, index }: { item: FlatListItem; index: number }) => {
      if (item.type === 'header') {
        return (
          <Text style={[s.catalogName, { color: grayColor }]}>
            {item.catalogName}
          </Text>
        )
      }
      return (
        <ClientMenuItemForUpdateOrder
          item={item.item}
          listIndex={index}
          showImage={showImage}
          primaryColor={primaryColor}
        />
      )
    },
    [showImage, primaryColor, grayColor],
  )

  const keyExtractor = useCallback(
    (item: FlatListItem) =>
      item.type === 'header' ? item.catalogSlug : item.item.slug,
    [],
  )

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: FlatListItem) => {
      layout.size =
        item.type === 'header'
          ? UPDATE_ORDER_CATALOG_HEADER_HEIGHT
          : UPDATE_ORDER_MENU_ITEM_HEIGHT
    },
    [],
  )

  const getItemType = useCallback((item: FlatListItem) => item.type, [])

  if (!hasUpdatingData) return null

  if (!branchSlug) {
    return (
      <View style={s.center}>
        <Text
          style={[
            s.grayText,
            { color: isDark ? colors.gray[400] : colors.gray[500] },
          ]}
        >
          {t(
            'menu.noBranchForMenu',
            'Không xác định được chi nhánh để tải thực đơn',
          )}
        </Text>
      </View>
    )
  }

  if (isLoadingMenu || isLoadingCatalog) {
    return (
      <View style={s.skeletonList}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              s.skeletonItem,
              { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] },
            ]}
          />
        ))}
      </View>
    )
  }

  if (!menuItems || menuItems.length === 0) {
    return (
      <View style={s.center}>
        <Text
          style={[
            s.grayText,
            { color: isDark ? colors.gray[400] : colors.gray[500] },
          ]}
        >
          {t('menu.noData', 'Không có dữ liệu')}
        </Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <FlashList<FlatListItem>
        data={flatListData}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        overrideItemLayout={overrideItemLayout}
        renderItem={renderItem}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { paddingBottom: 32, paddingTop: 8 },
  catalogName: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  grayText: { textAlign: 'center' },
  skeletonList: { padding: 16, gap: 12 },
  skeletonItem: { height: 104, borderRadius: 16, marginHorizontal: 16 },
})
