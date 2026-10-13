import { getRateFor, getExchangeRates } from "../../utils/exchangeRate.js";

export const getExchangeRatesController = async (req, res) => {
  try {
    const data = await getExchangeRates();

    if (!data || data.result !== "success") {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch exchange rates",
      });
    }

    res.json({
      success: true,
      rates: data.conversion_rates || {},
      base_currency: data.base_code || "INR",
    });
  } catch (error) {
    console.error("Exchange rates error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch exchange rates",
    });
  }
};

export const getExchangeRateController = async (req, res) => {
  try {
    const { currency } = req.params;

    if (!currency) {
      return res.status(400).json({
        success: false,
        message: "Currency parameter is required",
      });
    }

    const rate = await getRateFor(currency);

    res.json({
      success: true,
      currency: currency.toUpperCase(),
      rate,
    });
  } catch (error) {
    console.error("Exchange rate error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch exchange rate",
    });
  }
};
