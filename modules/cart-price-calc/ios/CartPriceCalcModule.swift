import ExpoModulesCore
import Foundation

public class CartPriceCalcModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CartPriceCalc")

    Function("calculateDisplayItems") { (orderItemsJson: String, voucherJson: String?) -> String in
      calculateDisplayItemsNative(orderItemsJson: orderItemsJson, voucherJson: voucherJson)
    }

    AsyncFunction("calculateDisplayItemsAsync") { (orderItemsJson: String, voucherJson: String?) -> String in
      calculateDisplayItemsNative(orderItemsJson: orderItemsJson, voucherJson: voucherJson)
    }

    Function("calculateRawSubTotal") { (orderItemsJson: String) -> Double in
      calculateRawSubTotal(orderItemsJson: orderItemsJson)
    }

    Function("formatCurrency") { (value: Double, currency: String) -> String in
      formatCurrencyNative(value: value, currency: currency)
    }

    Function("computeProductDetailTotal") { (price: Double, quantity: Double, toppingExtra: Double, promotionPercent: Double) -> Double in
      computeProductDetailTotalNative(price: price, quantity: Int(quantity), toppingExtra: toppingExtra, promotionPercent: promotionPercent)
    }
  }
}
