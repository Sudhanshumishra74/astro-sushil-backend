import { Router } from "express";
import {
  generateKundli,
  getGeoDetails,
  getMatchMaking,
  getDailyHoroscope,
} from "./astroApiController.js";

import {
  geoSchema,
  kundliSchema,
  matchMakingSchema,
} from "./astrology.validation.js";

import { validateAstrologyQuery } from "./validate.js";

const astrologyRouter = Router();

astrologyRouter.get(
  "/geo-details",
  validateAstrologyQuery(geoSchema),
  getGeoDetails,
);

astrologyRouter.get(
  "/generate-kundli",
  validateAstrologyQuery(kundliSchema),
  generateKundli,
);

astrologyRouter.get(
  "/match-making",
  validateAstrologyQuery(matchMakingSchema),
  getMatchMaking,
);

astrologyRouter.post("/daily-horoscope", getDailyHoroscope);

export default astrologyRouter;
