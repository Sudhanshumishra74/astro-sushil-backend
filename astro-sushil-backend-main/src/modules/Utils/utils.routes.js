import express from "express";
import {
  getExchangeRatesController,
  getExchangeRateController,
} from "./exchange.controller.js";

const router = express.Router();

router.get("/exchange-rates", getExchangeRatesController);
router.get("/exchange-rate/:currency", getExchangeRateController);

export default router;
