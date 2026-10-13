import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Report from "../modules/Reports/report.model.js";

dotenv.config();

const REPORT_FAQS = {
  basic_horoscope_pdf: [
    {
      question: "What is a Basic Horoscope Report?",
      answer:
        "A Basic Horoscope Report is a detailed birth chart analysis based on your date, time, and place of birth. It covers your core planetary positions, Rashi (moon sign), Lagna (ascendant), and key life insights including personality traits, strengths, and suitable career paths.",
    },
    {
      question: "What information do I need to provide?",
      answer:
        "You need to provide your full name, date of birth (DD/MM/YYYY), exact birth time (as accurate as possible), and place of birth (city and country). The more precise your birth time, the more accurate your reading will be.",
    },
    {
      question: "Is this report suitable for someone new to astrology?",
      answer:
        "Yes, the Basic Horoscope Report is specifically designed for beginners. It is written in clear, easy-to-understand language without heavy astrological jargon, making it a perfect starting point to explore your birth chart.",
    },
    {
      question: "How long does it take to receive my report?",
      answer:
        "Your report is generated and delivered digitally within 24–48 hours of placing your order. You will receive a download link to your registered email once processing is complete.",
    },
    {
      question: "Can I use this report for major life decisions?",
      answer:
        "The Basic Report gives you a solid foundation of self-awareness and is ideal for understanding your natural strengths. For in-depth guidance on major decisions like career shifts or investments, we recommend upgrading to the Pro Horoscope Report.",
    },
  ],

  mini_horoscope_pdf: [
    {
      question: "What time period does the Mini Horoscope cover?",
      answer:
        "The Mini Horoscope covers a short-term planetary forecast, typically spanning the next 3 to 6 months. It maps upcoming planetary transits and their impact on key areas of your daily life including work, health, and relationships.",
    },
    {
      question: "How is the Mini Horoscope different from the Basic Horoscope?",
      answer:
        "The Basic Horoscope is a one-time birth chart analysis covering your core nature and life tendencies. The Mini Horoscope is a time-bound forecast report that tracks current planetary movements and how they specifically affect you in the near future.",
    },
    {
      question: "When is the best time to order the Mini Horoscope?",
      answer:
        "The Mini Horoscope is most useful when you feel a period of change approaching — a new job, a move, or uncertainty in your routine. Ordering it at the start of a new month or quarter gives you the most actionable short-term guidance.",
    },
    {
      question: "Can I track monthly changes with this report?",
      answer:
        "Yes. The Mini Horoscope highlights significant planetary shifts on a month-by-month basis within the forecast window, helping you anticipate good and challenging periods so you can plan your actions accordingly.",
    },
    {
      question: "Will the report tell me which days or periods to avoid?",
      answer:
        "Yes. The report flags potentially difficult transit periods and recommends caution during those windows. It also highlights favourable periods for starting new ventures, making decisions, or taking important steps.",
    },
  ],

  pro_horoscope_pdf: [
    {
      question: "What makes the Pro Horoscope Report advanced?",
      answer:
        "The Pro Horoscope Report goes far beyond a basic birth chart. It includes an in-depth analysis of your Dasha (planetary period) cycles, Yogas (planetary combinations), wealth indicators, career trajectory, and long-term life predictions based on Vedic astrology principles.",
    },
    {
      question: "Who should get the Pro Horoscope Report?",
      answer:
        "This report is ideal for professionals, entrepreneurs, and individuals at a crossroads in their career or finances. If you are planning a major investment, business expansion, or career change, the Pro Report gives you a data-driven astrological roadmap.",
    },
    {
      question: "Does the Pro Report include wealth and financial predictions?",
      answer:
        "Yes. The Pro Report analyses your 2nd, 11th, and Dhan Yoga configurations to provide detailed financial predictions — including wealth accumulation periods, risk-prone phases, and the best timeframes for financial decisions.",
    },
    {
      question: "How detailed is the career and business analysis?",
      answer:
        "The career section examines your 10th house lord, current Dasha period, and relevant planetary transits to pinpoint your peak career windows, identify potential obstacles, and suggest optimal timing for promotions or business launches.",
    },
    {
      question: "Is this report based on Vedic or Western astrology?",
      answer:
        "The Pro Horoscope Report is based entirely on Vedic (Jyotish) astrology, which uses the sidereal zodiac and traditional Indian astrological methods refined over thousands of years. It is prepared by Astro Sushil with 35+ years of experience.",
    },
  ],

  match_making_pdf: [
    {
      question: "What is a Kundli Match Making Report?",
      answer:
        "A Kundli Match Making Report is a detailed compatibility analysis of two birth charts using Vedic astrology. It examines the Ashtakoot (8-point) system with 36 Gunas, along with Mangal Dosha, Nadi Dosha, and overall planetary harmony between partners.",
    },
    {
      question: "How many Gunas need to match for a good marriage?",
      answer:
        "Traditionally, a score of 18 or above out of 36 is considered acceptable for marriage compatibility. A score of 24 and above is considered very good, and 30+ is considered excellent. However, Dosha presence and overall chart harmony are equally important and assessed separately in this report.",
    },
    {
      question: "What if our Kundlis don't match well?",
      answer:
        "A lower Guna score does not necessarily mean the relationship is doomed. The report also suggests specific remedies — such as pujas, gemstones, or rituals — that can help neutralise planetary incompatibilities and strengthen the bond between partners.",
    },
    {
      question: "What information is needed for both partners?",
      answer:
        "You need to provide the full name, date of birth, exact birth time, and place of birth for both individuals. Accurate birth details for both partners are essential for a precise compatibility reading.",
    },
    {
      question: "Does the report check for Mangal Dosha?",
      answer:
        "Yes. Mangal Dosha (Mars affliction) is a key part of the analysis. The report checks whether either partner has Mangal Dosha, its intensity, and whether it is cancelled (Dosha Nivaran) by specific planetary placements — along with guidance on how to proceed.",
    },
    {
      question: "Can this report predict the long-term success of our marriage?",
      answer:
        "The report gives a comprehensive compatibility assessment covering emotional bonding, financial stability, family harmony, and longevity of the relationship. While astrology provides guidance based on planetary patterns, it should be used as one of many inputs when making the decision to marry.",
    },
  ],
};

async function seedReportFaqs() {
  await connectDB();

  let updated = 0;

  for (const [reportType, faqs] of Object.entries(REPORT_FAQS)) {
    const result = await Report.updateMany(
      { reportType },
      { $set: { faqs } },
    );
    console.log(
      `[${reportType}] matched: ${result.matchedCount}, modified: ${result.modifiedCount}`,
    );
    updated += result.modifiedCount;
  }

  console.log(`\nDone. Total reports updated: ${updated}`);
  await mongoose.disconnect();
}

seedReportFaqs().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
