package expo.modules.cartpricecalc

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CartPriceCalcModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CartPriceCalc")

    Function("calculateDisplayItems") { orderItemsJson: String, voucherJson: String? ->
      calculateDisplayItemsNative(orderItemsJson, voucherJson)
    }

    AsyncFunction("calculateDisplayItemsAsync") { orderItemsJson: String, voucherJson: String? ->
      calculateDisplayItemsNative(orderItemsJson, voucherJson)
    }.runOnQueue(Queues.DEFAULT)

    Function("calculateRawSubTotal") { orderItemsJson: String ->
      calculateRawSubTotal(orderItemsJson)
    }

    Function("formatCurrency") { value: Double, currency: String ->
      formatCurrencyNative(value, currency)
    }

    Function("computeProductDetailTotal") { price: Double, quantity: Double, toppingExtra: Double, promotionPercent: Double ->
      computeProductDetailTotalNative(price, quantity.toInt(), toppingExtra, promotionPercent)
    }
  }
}
