/**
 * Cart Price Calculator — Native port của utils/cart.ts
 * Logic voucher: ALL_REQUIRED, AT_LEAST_ONE_REQUIRED × PERCENT_ORDER, FIXED_VALUE, SAME_PRICE_PRODUCT
 */
package expo.modules.cartpricecalc

import org.json.JSONArray
import org.json.JSONObject

private object VoucherType {
  const val PERCENT_ORDER = "percent_order"
  const val FIXED_VALUE = "fixed_value"
  const val SAME_PRICE_PRODUCT = "same_price_product"
}

private object ApplicabilityRule {
  const val ALL_REQUIRED = "all_required"
  const val AT_LEAST_ONE_REQUIRED = "at_least_one_required"
}

private data class OrderItemInput(
  val id: String,
  val slug: String?,
  val quantity: Int,
  val originalPrice: Double,
  val promotionValue: Double?,
  val promotionDiscount: Double?,
  val name: String?,
  val image: String?,
  val size: String?,
  val note: String?,
  val productSlug: String?,
  val variant: Any?,
  val allVariants: Any?,
  val promotion: Any?,
  val description: String?,
  val isLimit: Boolean?,
  val isGift: Boolean?,
) {
  fun toMap(): MutableMap<String, Any?> {
    val m = mutableMapOf<String, Any?>(
      "id" to id,
      "slug" to slug,
      "quantity" to quantity,
      "originalPrice" to originalPrice,
    )
    name?.let { m["name"] = it }
    image?.let { m["image"] = it }
    size?.let { m["size"] = it }
    note?.let { m["note"] = it }
    productSlug?.let { m["productSlug"] = it }
    variant?.let { m["variant"] = it }
    allVariants?.let { m["allVariants"] = it }
    promotion?.let { m["promotion"] = it }
    description?.let { m["description"] = it }
    isLimit?.let { m["isLimit"] = it }
    isGift?.let { m["isGift"] = it }
    return m
  }

  companion object {
    fun fromJson(obj: JSONObject): OrderItemInput {
      fun getDouble(key: String): Double? = if (obj.has(key)) obj.getDouble(key) else null
      fun getInt(key: String): Int = if (obj.has(key)) obj.getInt(key) else 0
      fun getString(key: String): String? = if (obj.has(key)) obj.optString(key).takeIf { it != "null" } else null
      return OrderItemInput(
        id = obj.optString("id", ""),
        slug = getString("slug"),
        quantity = getInt("quantity"),
        originalPrice = obj.optDouble("originalPrice", 0.0),
        promotionValue = getDouble("promotionValue"),
        promotionDiscount = getDouble("promotionDiscount"),
        name = getString("name"),
        image = getString("image"),
        size = getString("size"),
        note = getString("note"),
        productSlug = getString("productSlug"),
        variant = if (obj.has("variant")) obj.get("variant") else null,
        allVariants = if (obj.has("allVariants")) obj.get("allVariants") else null,
        promotion = if (obj.has("promotion")) obj.get("promotion") else null,
        description = getString("description"),
        isLimit = if (obj.has("isLimit")) obj.getBoolean("isLimit") else null,
        isGift = if (obj.has("isGift")) obj.getBoolean("isGift") else null,
      )
    }
  }
}

private data class VoucherInput(
  val type: String,
  val value: Double,
  val applicabilityRule: String,
  val minOrderValue: Double,
  val voucherProducts: List<Map<String, Any>>,
) {
  companion object {
    fun fromJson(obj: JSONObject?): VoucherInput? {
      if (obj == null) return null
      val vps = mutableListOf<Map<String, Any>>()
      if (obj.has("voucherProducts")) {
        val arr = obj.getJSONArray("voucherProducts")
        for (i in 0 until arr.length()) {
          val vp = arr.getJSONObject(i)
          if (vp.has("product")) {
            val prod = vp.getJSONObject("product")
            val slug = prod.optString("slug", "")
            if (slug.isNotEmpty()) {
              vps.add(mapOf("product" to mapOf("slug" to slug)))
            }
          }
        }
      }
      return VoucherInput(
        type = obj.optString("type", ""),
        value = obj.optDouble("value", 0.0),
        applicabilityRule = obj.optString("applicabilityRule", ""),
        minOrderValue = obj.optDouble("minOrderValue", 0.0),
        voucherProducts = vps,
      )
    }
  }
}

private fun getRequiredSlugsSet(voucher: VoucherInput): Set<String> {
  return voucher.voucherProducts.mapNotNull { vp ->
    (vp["product"] as? Map<*, *>)?.get("slug") as? String
  }.filter { it.isNotEmpty() }.toSet()
}

private fun checkMinOrderValue(orderItems: List<OrderItemInput>, voucher: VoucherInput): Boolean {
  if (voucher.minOrderValue <= 0) return true
  val subtotal = orderItems.sumOf { item ->
    val orig = item.originalPrice
    val promo = item.promotionDiscount ?: 0.0
    (orig - promo) * item.quantity
  }
  return subtotal >= voucher.minOrderValue
}

private fun isVoucherApplicable(orderItems: List<OrderItemInput>, voucher: VoucherInput): Boolean {
  if (orderItems.isEmpty()) return false
  val requiredSlugs = getRequiredSlugsSet(voucher)
  if (requiredSlugs.isEmpty()) {
    return checkMinOrderValue(orderItems, voucher)
  }
  fun itemSlug(item: OrderItemInput) = item.slug ?: item.productSlug ?: ""
  if (voucher.applicabilityRule == ApplicabilityRule.ALL_REQUIRED) {
    if (!orderItems.all { requiredSlugs.contains(itemSlug(it)) }) return false
  } else if (voucher.applicabilityRule == ApplicabilityRule.AT_LEAST_ONE_REQUIRED) {
    if (!orderItems.any { requiredSlugs.contains(itemSlug(it)) }) return false
  }
  return checkMinOrderValue(orderItems, voucher)
}

private fun calculateCartItemDisplay(
  orderItems: List<OrderItemInput>,
  voucher: VoucherInput?,
): List<MutableMap<String, Any?>> {
  if (orderItems.isEmpty()) return emptyList()

  val (isVoucherValid, rule, type, eligibleSlugs) = if (voucher != null) {
    Quadruple(
      isVoucherApplicable(orderItems, voucher),
      voucher.applicabilityRule,
      voucher.type,
      getRequiredSlugsSet(voucher),
    )
  } else {
    Quadruple(false, "", "", emptySet())
  }

  val result = mutableListOf<MutableMap<String, Any?>>()
  for (item in orderItems) {
    val original = item.originalPrice
    val promoDiscount = item.promotionDiscount
      ?: (original * ((item.promotionValue ?: 0.0) / 100)).toInt().toDouble()
    val priceAfterPromo = maxOf(0.0, original - promoDiscount)
    val slug = item.slug ?: item.productSlug ?: ""
    val isEligible = eligibleSlugs.contains(slug)

    val out = item.toMap()
    out["priceAfterPromotion"] = priceAfterPromo
    out["promotionDiscount"] = promoDiscount

    if (!isVoucherValid || voucher == null) {
      out["finalPrice"] = priceAfterPromo
      out["voucherDiscount"] = 0
      result.add(out)
      continue
    }

    when (rule) {
      ApplicabilityRule.ALL_REQUIRED -> {
        when {
          type == VoucherType.PERCENT_ORDER && isEligible -> {
            out["finalPrice"] = priceAfterPromo
            out["voucherDiscount"] = 0
          }
          type == VoucherType.FIXED_VALUE && isEligible -> {
            out["finalPrice"] = priceAfterPromo
            out["voucherDiscount"] = 0
          }
          type == VoucherType.SAME_PRICE_PRODUCT && isEligible -> {
            val vVal = voucher.value
            val newPrice = if (vVal <= 1) (original * (1 - vVal)).toInt().toDouble()
            else minOf(original, vVal)
            out["finalPrice"] = newPrice
            out["priceAfterPromotion"] = priceAfterPromo
            out["promotionDiscount"] = 0
            out["voucherDiscount"] = original - newPrice
          }
          else -> {
            out["finalPrice"] = priceAfterPromo
            out["voucherDiscount"] = 0
          }
        }
      }
      ApplicabilityRule.AT_LEAST_ONE_REQUIRED -> {
        when {
          !isEligible -> {
            out["finalPrice"] = priceAfterPromo
            out["voucherDiscount"] = 0
          }
          type == VoucherType.PERCENT_ORDER -> {
            val vDiscount = ((voucher.value / 100) * original).toInt().toDouble()
            out["finalPrice"] = maxOf(0.0, original - vDiscount)
            out["priceAfterPromotion"] = original
            out["promotionDiscount"] = 0
            out["voucherDiscount"] = vDiscount
          }
          type == VoucherType.FIXED_VALUE -> {
            val vDiscount = minOf(original, voucher.value)
            out["finalPrice"] = maxOf(0.0, original - vDiscount)
            out["priceAfterPromotion"] = original
            out["promotionDiscount"] = 0
            out["voucherDiscount"] = vDiscount
          }
          type == VoucherType.SAME_PRICE_PRODUCT -> {
            val vVal = voucher.value
            val newPrice = if (vVal <= 1) (original * (1 - vVal)).toInt().toDouble()
            else minOf(original, vVal)
            out["finalPrice"] = newPrice
            out["priceAfterPromotion"] = original
            out["promotionDiscount"] = 0
            out["voucherDiscount"] = original - newPrice
          }
          else -> {
            out["finalPrice"] = priceAfterPromo
            out["voucherDiscount"] = 0
          }
        }
      }
      else -> {
        out["finalPrice"] = priceAfterPromo
        out["voucherDiscount"] = 0
      }
    }
    result.add(out)
  }
  return result
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

private fun sumBy(items: List<Map<String, Any?>>, fn: (Map<String, Any?>) -> Double): Double {
  return items.sumOf { fn(it) }
}

private fun getDouble(map: Map<String, Any?>, key: String): Double {
  return when (val v = map[key]) {
    is Number -> v.toDouble()
    else -> 0.0
  }
}

private fun getInt(map: Map<String, Any?>, key: String): Int {
  return when (val v = map[key]) {
    is Number -> v.toInt()
    else -> 0
  }
}

private fun getString(map: Map<String, Any?>, key: String): String {
  return (map[key] as? String) ?: ""
}

private fun calculateCartTotals(
  displayItems: List<Map<String, Any?>>,
  voucher: VoucherInput?,
): Map<String, Any> {
  val allowedSlugs = (voucher?.voucherProducts?.mapNotNull { vp ->
    (vp["product"] as? Map<*, *>)?.get("slug") as? String
  }?.filter { it.isNotEmpty() } ?: emptyList()).toSet()

  val subTotalBeforeDiscount = sumBy(displayItems) { item ->
    getDouble(item, "originalPrice") * getInt(item, "quantity")
  }

  val promotionDiscount = sumBy(displayItems) { item ->
    val slug = getString(item, "slug").ifEmpty { getString(item, "productSlug") }
    val shouldExclude = (voucher?.type == VoucherType.SAME_PRICE_PRODUCT ||
      ((voucher?.type == VoucherType.PERCENT_ORDER || voucher?.type == VoucherType.FIXED_VALUE) &&
        voucher?.applicabilityRule == ApplicabilityRule.AT_LEAST_ONE_REQUIRED)) &&
      allowedSlugs.contains(slug) &&
      getDouble(item, "voucherDiscount") > 0

    val promo = getDouble(item, "promotionDiscount")
    val discount = if (!shouldExclude && promo > 0) promo else 0.0
    discount * getInt(item, "quantity")
  }

  var voucherDiscount = 0.0
  if (voucher != null) {
    val rule = voucher.applicabilityRule
    val type = voucher.type
    when (type) {
      VoucherType.SAME_PRICE_PRODUCT -> {
        voucherDiscount = sumBy(displayItems) { item ->
          val slug = getString(item, "slug").ifEmpty { getString(item, "productSlug") }
          if (allowedSlugs.contains(slug)) {
            getDouble(item, "voucherDiscount") * getInt(item, "quantity")
          } else 0.0
        }
      }
      VoucherType.PERCENT_ORDER -> {
        if (rule == ApplicabilityRule.ALL_REQUIRED) {
          val totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
          voucherDiscount = ((voucher.value / 100) * totalAfterPromo).toInt().toDouble()
        } else {
          voucherDiscount = sumBy(displayItems) { item ->
            getDouble(item, "voucherDiscount") * getInt(item, "quantity")
          }
        }
      }
      VoucherType.FIXED_VALUE -> {
        if (rule == ApplicabilityRule.ALL_REQUIRED) {
          val totalAfterPromo = subTotalBeforeDiscount - promotionDiscount
          voucherDiscount = minOf(voucher.value, totalAfterPromo)
        } else {
          voucherDiscount = sumBy(displayItems) { item ->
            getDouble(item, "voucherDiscount") * getInt(item, "quantity")
          }
        }
      }
    }
  }

  val finalTotal = subTotalBeforeDiscount - promotionDiscount - voucherDiscount

  return mapOf(
    "subTotalBeforeDiscount" to subTotalBeforeDiscount,
    "promotionDiscount" to promotionDiscount,
    "voucherDiscount" to voucherDiscount,
    "finalTotal" to finalTotal,
  )
}

private fun mapToJsonArray(items: List<Map<String, Any?>>): JSONArray {
  val arr = JSONArray()
  for (item in items) {
    arr.put(mapToJsonObject(item))
  }
  return arr
}

private fun mapToJsonObject(m: Map<String, Any?>): JSONObject {
  val obj = JSONObject()
  for ((k, v) in m) {
    when (v) {
      null -> obj.put(k, JSONObject.NULL)
      is Number -> obj.put(k, v)
      is Boolean -> obj.put(k, v)
      is String -> obj.put(k, v)
      is Map<*, *> -> obj.put(k, mapToJsonObject(v as Map<String, Any?>))
      is List<*> -> obj.put(k, listToJsonArray(v))
      is org.json.JSONObject -> obj.put(k, v)
      is org.json.JSONArray -> obj.put(k, v)
      else -> obj.put(k, v?.toString() ?: "")
    }
  }
  return obj
}

private fun listToJsonArray(list: List<*>): JSONArray {
  val arr = JSONArray()
  for (v in list) {
    when (v) {
      null -> arr.put(JSONObject.NULL)
      is Number -> arr.put(v)
      is Boolean -> arr.put(v)
      is String -> arr.put(v)
      is Map<*, *> -> arr.put(mapToJsonObject(v as Map<String, Any?>))
      is List<*> -> arr.put(listToJsonArray(v))
      is org.json.JSONObject -> arr.put(v)
      is org.json.JSONArray -> arr.put(v)
      else -> arr.put(v?.toString() ?: "")
    }
  }
  return arr
}

private val emptyResultJson = """{"displayItems":[],"totals":{"subTotalBeforeDiscount":0,"promotionDiscount":0,"voucherDiscount":0,"finalTotal":0}}"""

fun calculateRawSubTotal(orderItemsJson: String): Double {
  return try {
    val itemsArray = JSONArray(orderItemsJson)
    var sum = 0.0
    for (i in 0 until itemsArray.length()) {
      val item = OrderItemInput.fromJson(itemsArray.getJSONObject(i))
      sum += item.originalPrice * item.quantity
    }
    sum
  } catch (_: Exception) {
    0.0
  }
}

private val viNumberFormat =
  java.text.DecimalFormat("#,##0.##", java.text.DecimalFormatSymbols(java.util.Locale("vi", "VN"))).apply {
    minimumFractionDigits = 0
    maximumFractionDigits = 0
  }

fun formatCurrencyNative(value: Double, currency: String): String {
  val safeValue = if (value < 0) 0.0 else value
  return "${viNumberFormat.format(safeValue)} $currency"
}

fun computeProductDetailTotalNative(
  price: Double,
  quantity: Int,
  toppingExtra: Double,
  promotionPercent: Double,
): Double {
  if (price < 0) return 0.0
  val afterDiscount = price * (1 - promotionPercent / 100)
  return (afterDiscount + toppingExtra) * quantity
}

fun calculateDisplayItemsNative(orderItemsJson: String, voucherJson: String?): String {
  return try {
    val itemsArray = JSONArray(orderItemsJson)
    val orderItems = List(itemsArray.length()) { i ->
      OrderItemInput.fromJson(itemsArray.getJSONObject(i))
    }

    val voucher = when {
      voucherJson.isNullOrEmpty() -> null
      else -> try {
        VoucherInput.fromJson(JSONObject(voucherJson))
      } catch (_: Exception) {
        null
      }
    }

    val displayItems = calculateCartItemDisplay(orderItems, voucher)
    val totals = calculateCartTotals(displayItems, voucher)

    val result = JSONObject().apply {
      put("displayItems", mapToJsonArray(displayItems))
      put("totals", mapToJsonObject(totals))
    }
    result.toString()
  } catch (_: Exception) {
    emptyResultJson
  }
}
