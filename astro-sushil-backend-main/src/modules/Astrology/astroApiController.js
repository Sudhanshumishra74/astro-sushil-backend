import { astrologyApiRequest } from "../../service/astroApi.js";
import { generateMatchReport } from "./generateMatchReportPDF.js";

import fs from "fs";
import os from "os";
import path from "path";
import PDFDocument from "pdfkit";

export const getGeoDetails = async (req, res) => {
  try {
    const result = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEOCODING_API_KEY,
          "X-Goog-FieldMask": "places.formattedAddress,places.location",
        },
        body: JSON.stringify({
          textQuery: req.query.place,
        }),
      },
    );
    const data = await result.json();

    if (!result.ok) {
      throw new Error(`${data?.error?.message} Failed to fetch geocoding data`);
    }
    return res.json(data?.places ?? []);
  } catch (error) {
    return res.status(500).json(error.message || "Internal Server Error");
  }
};

export const generateKundli = async (req, res) => {
  try {
    const result = await astrologyApiRequest({
      path: "generate_astrology_kundli",
      body: req.query,
    });

    console.log("result", result);

    return res.json(result);
  } catch (error) {
    return res.status(500).json(error.message || "Internal Server Error");
  }
};

export const getMatchMaking = async (req, res) => {
  try {
    // male_name/female_name are accepted for display purposes only (see
    // matchMakingSchema) — the vendor's match endpoint has no name field,
    // so they're excluded from the forwarded body.
    const { male_name, female_name, ...vendorQuery } = req.query;

    const result = await astrologyApiRequest({
      path: "match",
      body: vendorQuery,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json(error.message || "Internal Server Error");
  }
};

export const getDailyHoroscope = async (req, res) => {
  try {
    const result = await astrologyApiRequest({
      path: "dailyhoroscope",
      body: req.body,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json(error.message || "Internal Server Error");
  }
};
