/**
 * Cart Price Calculator — Native port của utils/cart.ts
 * Logic voucher: ALL_REQUIRED, AT_LEAST_ONE_REQUIRED × PERCENT_ORDER, FIXED_VALUE, SAME_PRICE_PRODUCT
 */
import Foundation

private enum VoucherType {
  static let percentOrder = "percent_order"
  static let fixedValue = "fixed_value"
  static let samePriceProduct = "same_price_product"
}

private enum ApplicabilityRule {
  static let allRequired = "all_required"
  static let atLeastOneRequired = "at_least_one_required"
}

struct OrderItemInput {
  var id: String
  var slug: String?
  var quantity: Int
  var originalPrice: Double
  var promotionValue: Double?
  var promotionDiscount: Double?
  var name: String?
  var image: String?
  var size: String?
  var note: String?
  var productSlug: String?
  var variant: [String: Any]?
  var allVariants: [[String: Any]]?
  var promotion: [String: Any]?
  var promotionValueNum: Double?
  var description: String?
  var isLimit: Bool?
  var isGift: Bool?

  init(from dict: [String: Any]) {
    id = dict["id"] as? String ?? ""
    slug = dict["slug"] as? String
    quantity = (dict["quantity"] as? NSNumber)?.intValue ?? 0
    originalPrice = (dict["originalPrice"] as? NSNumber)?.doubleValue ?? 0
    promotionValue = (dict["promotionValue"] as? NSNumber)?.doubleValue
    promotionDiscount = (dict["promotionDiscount"] as? NSNumber)?.doubleValue
    name = dict["name"] as? String
    image = dict["image"] as? String
    size = dict["size"] as? String
    note = dict["note"] as? String
    productSlug = dict["productSlug"] as? String
    variant = dict["variant"] as? [String: Any]
    allVariants = dict["allVariants"] as? [[String: Any]]
    promotion = dict["promotion"] as? [String: Any]
    promotionValueNum = (dict["promotionValue"] as? NSNumber)?.doubleValue
    description = dict["description"] as? String
    isLimit = dict["isLimit"] as? Bool
    isGift = dict["isGift"] as? Bool
  }

  func toDict() -> [String: Any] {
    var d: [String: Any] = [
      "id": id,
      "slug": slug as Any,
      "quantity": quantity,
      "originalPrice": originalPrice,
    ]
    if let v = name { d["name"] = v }
    if let v = image { d["image"] = v }
    if let v = size { d["size"] = v }
    if let v = note { d["note"] = v }
    if let v = productSlug { d["productSlug"] = v }
    if let v = variant { d["variant"] = v }
    if let v = allVariants { d["allVariants"] = v }
    if let v = promotion { d["promotion"] = v }
    if let v = description { d["description"] = v }
    if let v = isLimit { d["isLimit"] = v }
    if let v = isGift { d["isGift"] = v }
    return d
  }
}

struct VoucherInput {
  var type: String
  var value: Double
  var applicabilityRule: String
  var minOrderValue: Double
  var voucherProducts: [[String: Any]]

  init?(from dict: [String: Any]?) {
    guard let d = dict else { return nil }
    type = d["type"] as? String ?? ""
    value = (d["value"] as? NSNumber)?.doubleValue ?? 0
    applicabilityRule = d["applicabilityRule"] as? String ?? ""
    minOrderValue = (d["minOrderValue"] as? NSNumber)?.doubleValue ?? 0
    let vps = d["voucherProducts"] as? [[String: Any]] ?? []
    voucherProducts = vps.compactMap { vp -> [String: Any]? in
      guard let prod = vp["product"] as? [String: Any],
            let slug = prod["slug"] as? String, !slug.isEmpty else { return nil }
      return ["product": ["slug": slug]]
    }
  }
}

// MARK: - Helpers

private func getRequiredSlugsSet(voucher: VoucherInput) -> Set<String> {
  let slugs = voucher.voucherProducts.compactMap { vp -> String? in
    guard let prod = vp["product"] as? [String: Any],
          let slug = prod["slug"] as? String, !slug.isEmpty else { return nil }
    return slug
  }
  return Set(slugs)
}

private func checkMinOrderValue(orderItems: [OrderItemInput], voucher: VoucherInput) -> Bool {
  if voucher.minOrderValue <= 0 { return true }
  var subtotal: Double = 0
  for item in orderItems {
    let orig = item.originalPrice
    let promo = item.promotionDiscount ?? 0
    subtotal += (orig - promo) * Double(item.quantity)
  }
  return subtotal >= voucher.minOrderValue
}

private func isVoucherApplicable(orderItems: [OrderItemInput], voucher: VoucherInput) -> Bool {
  if orderItems.isEmpty { return false }
  let requiredSlugs = getRequiredSlugsSet(voucher: voucher)
  if requiredSlugs.isEmpty {
    return checkMinOrderValue(orderItems: orderItems, voucher: voucher)
  }
  let itemSlug: (OrderItemInput) -> String = { $0.slug ?? $0.productSlug ?? "" }
  if voucher.applicabilityRule == ApplicabilityRule.allRequired {
    let allIn = orderItems.allSatisfy { requiredSlugs.contains(itemSlug($0)) }
    if !allIn { return false }
  } else if voucher.applicabilityRule == ApplicabilityRule.atLeastOneRequired {
    let hasOne = orderItems.contains { requiredSlugs.contains(itemSlug($0)) }
    if !hasOne { return false }
  }
  return checkMinOrderValue(orderItems: orderItems, voucher: voucher)
}

// MARK: - calculateCartItemDisplay

private func calculateCartItemDisplay(
  orderItems: [OrderItemInput],
  voucher: VoucherInput?
) -> [[String: Any]] {
  guard !orderItems.isEmpty else { return [] }

  let isVoucherValid: Bool
  let rule: String
  let type: String
  let eligibleSlugs: Set<String>

  if let v = voucher {
    isVoucherValid = isVoucherApplicable(orderItems: orderItems, voucher: v)
    rule = v.applicabilityRule
    type = v.type
    eligibleSlugs = getRequiredSlugsSet(voucher: v)
  } else {
    isVoucherValid = false
    rule = ""
    type = ""
    eligibleSlugs = []
  }

  var result: [[String: Any]] = []
  for item in orderItems {
    let original = item.originalPrice
    let promoDiscount = item.promotionDiscount ?? Double(Int(original * ((item.promotionValue ?? 0) / 100)))
    let priceAfterPromo = max(0, original - promoDiscount)
    let slug = item.slug ?? item.productSlug ?? ""
    let isEligible = eligibleSlugs.contains(slug)

    var out = item.toDict()
    out["priceAfterPromotion"] = priceAfterPromo
    out["promotionDiscount"] = promoDiscount

    if !isVoucherValid || voucher == nil {
      out["finalPrice"] = priceAfterPromo
      out["voucherDiscount"] = 0
      result.append(out)
      continue
    }

    if rule == ApplicabilityRule.allRequired {
      if type == VoucherType.percentOrder && isEligible {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      } else if type == VoucherType.fixedValue && isEligible {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      } else if type == VoucherType.samePriceProduct && isEligible {
        let vVal = voucher!.value
        let newPrice = vVal <= 1
          ? Double(Int(original * (1 - vVal)))
          : min(original, vVal)
        out["finalPrice"] = newPrice
        out["priceAfterPromotion"] = priceAfterPromo
        out["promotionDiscount"] = 0
        out["voucherDiscount"] = original - newPrice
      } else {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      }
    } else if rule == ApplicabilityRule.atLeastOneRequired {
      if !isEligible {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      } else if type == VoucherType.percentOrder {
        let vDiscount = Double(Int(((voucher!.value) / 100) * original))
        out["finalPrice"] = max(0, original - vDiscount)
        out["priceAfterPromotion"] = original
        out["promotionDiscount"] = 0
        out["voucherDiscount"] = vDiscount
      } else if type == VoucherType.fixedValue {
        let vDiscount = min(original, voucher!.value)
        out["finalPrice"] = max(0, original - vDiscount)
        out["priceAfterPromotion"] = original
        out["promotionDiscount"] = 0
        out["voucherDiscount"] = vDiscount
      } else if type == VoucherType.samePriceProduct {
        let vVal = voucher!.value
        let newPrice = vVal <= 1
          ? Double(Int(original * (1 - vVal)))
          : min(original, vVal)
        out["finalPrice"] = newPrice
        out["priceAfterPromotion"] = original
        out["promotionDiscount"] = 0
        out["voucherDiscount"] = original - newPrice
      } else {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      }
    } else {
      out["finalPrice"] = priceAfterPromo
      out["voucherDiscount"] = 0
    }
    result.append(out)
  }
  return result
}

// MARK: - calculateCartTotals

private func sumBy(_ items: [[String: Any]], fn: ([String: Any]) -> Double) -> Double {
  var sum: Double = 0
  for item in items {
    sum += fn(item)
  }
  return sum
}

private func calculateCartTotals(
  displayItems: [[String: Any]],
  voucher: VoucherInput?
) -> [String: Any] {
  let allowedSlugs = Set(
    (voucher?.voucherProducts ?? []).compactMap { vp -> String? in
      (vp["product"] as? [String: Any])?["slug"] as? String
    }.filter { !$0.isEmpty }
  )

  let subTotalBeforeDiscount = sumBy(displayItems) { item in
    let orig = (item["originalPrice"] as? NSNumber)?.doubleValue ?? 0
    let qty = (item["quantity"] as? NSNumber)?.intValue ?? 0
    return orig * Double(qty)
  }

  let promotionDiscount = sumBy(displayItems) { item in
    let slug = item["slug"] as? String ?? item["productSlug"] as? String ?? ""
    let shouldExclude = (voucher?.type == VoucherType.samePriceProduct ||
      ((voucher?.type == VoucherType.percentOrder || voucher?.type == VoucherType.fixedValue) &&
        voucher?.applicabilityRule == ApplicabilityRule.atLeastOneRequired)) &&
      allowedSlugs.contains(slug) &&
      ((item["voucherDiscount"] as? NSNumber)?.doubleValue ?? 0) > 0

    let promo = (item["promotionDiscount"] as? NSNumber)?.doubleValue ?? 0
    let discount = !shouldExclude && promo > 0 ? promo : 0
    let qty = (item["quantity"] as? NSNumber)?.intValue ?? 0
    return discount * Double(qty)
  }

  var voucherDiscount: Double = 0
  if let v = voucher {
    let rule = v.applicabilityRule
    let type = v.type
    if type == VoucherType.samePriceProduct {
      voucherDiscount = sumBy(displayItems) { item in
        let slug = item["slug"] as? String ?? item["productSlug"] as? String ?? ""
        if allowedSlugs.contains(slug) {
          let vd = (item["voucherDiscount"] as? NSNumber)?.doubleValue ?? 0
          let qty = (item["quantity"] as? NSNumber)?.intValue ?? 0
          return vd * Double(qty)
        }
        return 0
      }
    } else if type == VoucherType.percentOrder {
      if rule == ApplicabilityRule.allRequired {
        let totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = Double(Int((v.value / 100) * totalAfterPromo))
      } else {
        voucherDiscount = sumBy(displayItems) { item in
          let vd = (item["voucherDiscount"] as? NSNumber)?.doubleValue ?? 0
          let qty = (item["quantity"] as? NSNumber)?.intValue ?? 0
          return vd * Double(qty)
        }
      }
    } else if type == VoucherType.fixedValue {
      if rule == ApplicabilityRule.allRequired {
        let totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
        voucherDiscount = min(v.value, totalAfterPromo)
      } else {
        voucherDiscount = sumBy(displayItems) { item in
          let vd = (item["voucherDiscount"] as? NSNumber)?.doubleValue ?? 0
          let qty = (item["quantity"] as? NSNumber)?.intValue ?? 0
          return vd * Double(qty)
        }
      }
    }
  }

  let finalTotal = subTotalBeforeDiscount - promotionDiscount - voucherDiscount

  return [
    "subTotalBeforeDiscount": subTotalBeforeDiscount,
    "promotionDiscount": promotionDiscount,
    "voucherDiscount": voucherDiscount,
    "finalTotal": finalTotal,
  ]
}

func calculateRawSubTotal(orderItemsJson: String) -> Double {
  guard let itemsData = orderItemsJson.data(using: .utf8),
        let itemsArray = try? JSONSerialization.jsonObject(with: itemsData) as? [[String: Any]] else {
    return 0
  }
  return itemsArray.reduce(0) { sum, dict in
    let item = OrderItemInput(from: dict)
    return sum + item.originalPrice * Double(item.quantity)
  }
}

private let viNumberFormatter: NumberFormatter = {
  let f = NumberFormatter()
  f.locale = Locale(identifier: "vi_VN")
  f.numberStyle = .decimal
  f.minimumFractionDigits = 0
  f.maximumFractionDigits = 0
  return f
}()

func formatCurrencyNative(value: Double, currency: String) -> String {
  let safeValue = value < 0 ? 0 : value
  let formatted = viNumberFormatter.string(from: NSNumber(value: safeValue)) ?? "\(Int(safeValue))"
  return "\(formatted) \(currency)"
}

func computeProductDetailTotalNative(
  price: Double,
  quantity: Int,
  toppingExtra: Double,
  promotionPercent: Double
) -> Double {
  guard price >= 0 else { return 0 }
  let afterDiscount = price * (1 - promotionPercent / 100)
  return (afterDiscount + toppingExtra) * Double(quantity)
}

// MARK: - Public

func calculateDisplayItemsNative(
  orderItemsJson: String,
  voucherJson: String?
) -> String {
  guard let itemsData = orderItemsJson.data(using: .utf8),
        let itemsArray = try? JSONSerialization.jsonObject(with: itemsData) as? [[String: Any]] else {
    return emptyResultJson
  }

  let orderItems = itemsArray.map { OrderItemInput(from: $0) }

  var voucher: VoucherInput?
  if let vStr = voucherJson, !vStr.isEmpty,
     let vData = vStr.data(using: .utf8),
     let vDict = try? JSONSerialization.jsonObject(with: vData) as? [String: Any] {
    voucher = VoucherInput(from: vDict)
  }

  let displayItems = calculateCartItemDisplay(orderItems: orderItems, voucher: voucher)
  let totals = calculateCartTotals(displayItems: displayItems, voucher: voucher)

  let result: [String: Any] = [
    "displayItems": displayItems,
    "totals": totals,
  ]

  guard let data = try? JSONSerialization.data(withJSONObject: result),
        let str = String(data: data, encoding: .utf8) else {
    return emptyResultJson
  }
  return str
}

private let emptyResultJson = "{\"displayItems\":[],\"totals\":{\"subTotalBeforeDiscount\":0,\"promotionDiscount\":0,\"voucherDiscount\":0,\"finalTotal\":0}}"
