// import puppeteer from "puppeteer";

// const generatePDFBuffer = async (htmlContent) => {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
//   await page.setContent(htmlContent, { waitUntil: "networkidle0", timeout: 0 });
//   const pdfBuffer = await page.pdf({
//     format: "A4",
//     printBackground: true,
//   });
//   await browser.close();
//   return pdfBuffer;
// };

// // ─────────────────────────────────────────────
// // PRESET SECTION GROUPS — use these in controller
// // ─────────────────────────────────────────────
// export const KUNDLI_PRESETS = {
//   FULL: null, // null = all sections
//   LAL_KITAB: [
//     "cover",
//     "welcome",
//     "lalkitab_planets",
//     "lalkitab_horoscope",
//     "lalkitab_remedies_1",
//     "lalkitab_remedies_2",
//     "lalkitab_debts",
//     "lalkitab_houses_1",
//     "lalkitab_houses_2",
//     "lalkitab_houses_3",
//     "disclaimer",
//   ],
//   PANCHANG: [
//     "cover",
//     "welcome",
//     "panchang",
//     "advanced_panchang",
//     "monthly_panchang",
//     "panchang_chart",
//     "panchang_hora_muhurta_dinman",
//     "panchang_lagna_table",
//     "chaughadiya",
//     "hora_muhurta",
//     "hora_muhurta_dinman",
//     "ghat_chakra",
//     "disclaimer",
//   ],
//   DASHA: [
//     "cover",
//     "welcome",
//     "vimshottari_dasha",
//     "antar_dasha",
//     "yogini_dasha",
//     "major_yogini_dasha",
//     "chara_dasha",
//     "disclaimer",
//   ],
//   BIRTH_CHART: [
//     "cover",
//     "welcome",
//     "basic_info",
//     "astro_details",
//     "planets",
//     "charts_1",
//     "charts_2",
//     "disclaimer",
//   ],
//   KP: ["cover", "welcome", "kp_system", "kp_house_cusps", "disclaimer"],
// };

// // ─────────────────────────────────────────────
// // SHARED ASSETS
// // ─────────────────────────────────────────────
// const BG_IMAGE =
//   "https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/bg_pages.jpg";
// const KALASH_IMAGE =
//   "https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/kalash.png";

// const kalashFooter = () => `
//   <div class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0">
//     <img src="${KALASH_IMAGE}" class="w-[80px]" alt="" />
//     <img src="${KALASH_IMAGE}" class="w-[80px]" alt="" />
//   </div>
// `;

// const sectionWrap = (inner) => `
//   <section class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//     style="background-image: url(&quot;${BG_IMAGE}&quot;)">
//     ${inner}
//     ${kalashFooter()}
//   </section>
// `;

// const sectionTitle = (title) => `
//   <div class="flex items-center justify-center">
//     <span class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2">
//       ${title}
//     </span>
//   </div>
// `;

// // ─────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────
// const formatTime = (decimal) => {
//   if (!decimal) return "-";
//   const hours = Math.floor(decimal);
//   const minutes = Math.round((decimal - hours) * 60);
//   return `${hours}:${minutes.toString().padStart(2, "0")}`;
// };

// const formatDate = (dateStr) => {
//   if (!dateStr) return "-";
//   try {
//     const [datePart, timePart] = dateStr.split("  ");
//     const [d, m, y] = datePart.split("-").map((part) => part.padStart(2, "0"));
//     return `${d}-${m}-${y} ${timePart || ""}`;
//   } catch {
//     return dateStr;
//   }
// };

// // ─────────────────────────────────────────────
// // HTML WRAPPER (head + body open/close)
// // ─────────────────────────────────────────────
// const wrapHTML = (sectionsHTML) => `
// <!doctype html>
// <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <title>Kundli Report</title>
//     <script src="https://cdn.tailwindcss.com"></script>
//     <style>
//       body { font-family: "Segoe UI", sans-serif; }
//       .heading_font { font-family: "Georgia", serif; font-weight: bold; }
//       .section { min-height: 100vh; background: url("${BG_IMAGE}") center/contain no-repeat; position: relative; }
//       .kalash { position: absolute; bottom: 30px; width: 90px; }
//       .kalash-left { left: 40px; }
//       .kalash-right { right: 40px; }
//       table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
//       th, td { border: 1px solid #9d2235; padding: 10px; text-align: center; }
//       th { background: #9d2235; color: white; }
//     </style>
//   </head>
//   <body class="mx-auto">
//     ${sectionsHTML}
//   </body>
// </html>`;

// const buildSections = (data) => {
//   const birth_details_data = data?.birth_details || {};
//   const astro_details_data = data?.astro_details || {};
//   const basic_panchang_data = data?.basic_panchang || {};
//   const chaughadiya_muhurta = data?.chaughadiya_muhurta || {};
//   const hora_muhurta = data?.hora_muhurta || {};
//   const ayanamsha = data?.ayanamsha || {};
//   const hora_muhurta_dinman = data?.hora_muhurta_dinman || {};
//   const general_rashi_report = data?.general_rashi_report || {};
//   const general_house_report = data?.general_house_report || {};
//   const ghat_chakra = data?.ghat_chakra || {};
//   const current_chardasha = data?.current_chardasha || {};
//   const planet_panchang = data?.planet_panchang || {};
//   const current_yogini_dasha = data?.current_yogini_dasha || {};
//   const jaimini_details = data?.jaimini_details || {};
//   const planet_nature = data?.planet_nature || {};
//   const monthly_panchang = data?.monthly_panchang || {};
//   const lalkitab_remedies = data?.lalkitab_remedies || {};
//   const bhav_madhya = data?.bhav_madhya || {};
//   const panchang_chart = data?.panchang_chart || {};
//   const panchang_hora_muhurta_dinman = data?.panchang_hora_muhurta_dinman || {};
//   const lalkitab_planets = data?.lalkitab_planets || {};
//   const daily_nakshatra_prediction = data?.daily_nakshatra_prediction || {};
//   const major_yogini_dasha = data?.major_yogini_dasha || {};
//   const general_nakshatra_report = data?.general_nakshatra_report || {};
//   const sarvashtak = data?.sarvashtak || {};
//   const lalkitab_debts = data?.lalkitab_debts || {};
//   const lalkitab_houses = data?.lalkitab_houses || {};
//   const moon_biorhythm = data?.moon_biorhythm || {};
//   const kp_planets = data?.kp_planets || [];
//   const general_ascendant_report = data?.general_ascendant_report || {};
//   const lalkitab_horoscope = data?.lalkitab_horoscope || {};
//   const sub_yogini_dasha = data?.sub_yogini_dasha || {};
//   const advanced_panchang = data?.advanced_panchang || {};
//   const vishamansha_chart = data?.vishamansha_chart || {};
//   const trishamansha_chart = data?.trishamansha_chart || {};
//   const akshvedansha_chart = data?.akshvedansha_chart || {};
//   const panchmansha_chart = data?.panchmansha_chart || {};
//   const chathurthamasha_chart = data?.chathurthamasha_chart || {};
//   const chaturvimshamsha_chart = data?.chaturvimshamsha_chart || {};
//   const sun_chart = data?.sun_chart || {};
//   const panchang_lagna_table = data?.panchang_lagna_table || {};
//   const ashtamansha_chart = data?.ashtamansha_chart || {};
//   const moon_chart = data?.moon_chart || {};
//   const bhamsha_chart = data?.bhamsha_chart || {};
//   const hora_chart = data?.hora_chart || {};
//   const dwadashamsha_chart = data?.dwadashamsha_chart || {};
//   const shodashamsha_chart = data?.shodashamsha_chart || {};
//   const birth_chart_data = data?.birth_chart || {};
//   const navamansha_chart_data = data?.navamansha_chart || {};
//   const planets_data = data?.planets || [];
//   const vimshottri_major_vdasha_data = data?.vimshottri_major_vdasha || [];
//   const vimshottri_antar_vdasha_data = data?.vimshottri_antar_vdasha || {};
//   const kp_planets_data = data?.kp_planets || [];
//   const kp_house_cusps_data = data?.kp_house_cusps || [];
//   const chalit_chart_data = data?.chalit_chart || {};
//   const dashamansha_chart_data = data?.dashamansha_chart || {};
//   const saptamansha_chart_data = data?.saptamansha_chart || {};

//   const dayHoras = hora_muhurta?.hora?.day || [];
//   const nightHoras = hora_muhurta?.hora?.night || [];
//   const dayHorasmuhurta_dinman = hora_muhurta_dinman?.hora?.day || [];
//   const nightHorasmuhurta_dinman = hora_muhurta_dinman?.hora?.night || [];
//   const karakas = jaimini_details?.jaimini_karaka || {};
//   const dayHorasPanchnag = panchang_hora_muhurta_dinman?.hora?.day || [];
//   const nightHorasPanchnag = panchang_hora_muhurta_dinman?.hora?.night || [];
//   const tithi = advanced_panchang?.tithi?.details || {};
//   const nakshatra = advanced_panchang?.nakshatra?.details || {};
//   const yog = advanced_panchang?.yog?.details || {};
//   const karan = advanced_panchang?.karan?.details || {};
//   const hinduMaah = advanced_panchang?.hindu_maah || {};
//   const madhyaList = bhav_madhya?.bhav_madhya || [];
//   const sandhiList = bhav_madhya?.bhav_sandhi || [];
//   const panchangList = monthly_panchang?.panchang || [];
//   const asc_report = general_ascendant_report?.asc_report || {};
//   const ashtakPoints = sarvashtak?.ashtak_points || {};
//   const prediction = daily_nakshatra_prediction?.prediction || {};
//   const currentTimestamp = Date.now();

//   const kp = data?.kp_details || {};
//   const basic = kp?.basic_details || {};
//   const kpPlanets = kp?.planets || [];
//   const kpHouses = kp?.houses || [];

//   let kpBasicHTML = "";
//   if (Object.keys(basic).length > 0) {
//     kpBasicHTML = `
//     <div class="mb-10">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">KP Basic Details</h3>
//       <table style="width:100%; border-collapse:collapse; font-size:14px; background:white;">
//         <tr><td style="padding:10px; border:1px solid #ddd; width:45%;"><strong>Ayanamsa</strong></td><td style="padding:10px; border:1px solid #ddd;">${Number(basic.ayanamsha || 0).toFixed(6)}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Sunrise</strong></td><td style="padding:10px; border:1px solid #ddd;">${basic.sunrise || "-"}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Sunset</strong></td><td style="padding:10px; border:1px solid #ddd;">${basic.sunset || "-"}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Ascendant (Lagna)</strong></td><td style="padding:10px; border:1px solid #ddd;">${basic.ascendant || "-"}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Moon Rashi</strong></td><td style="padding:10px; border:1px solid #ddd;">${basic.rashi || "-"}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Birth Nakshatra</strong></td><td style="padding:10px; border:1px solid #ddd;">${basic.nakshatra || "-"}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Vimshottari Dasha Balance</strong></td><td style="padding:10px; border:1px solid #ddd; font-weight:600;">${basic.dasha_balance || "-"}</td></tr>
//       </table>
//     </div>`;
//   }

//   let kpPlanetsHTML = "";
//   if (kpPlanets.length > 0) {
//     kpPlanetsHTML = `
//     <div class="mb-10">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">KP Planet Positions & Sub-Lords</h3>
//       <div style="overflow-x:auto;">
//         <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:700px;">
//           <thead><tr style="background:#F6CFD5; color:#5E1520;">
//             <th style="padding:10px; border:1px solid #ccc;">Planet</th>
//             <th style="padding:10px; border:1px solid #ccc;">Sign</th>
//             <th style="padding:10px; border:1px solid #ccc;">House</th>
//             <th style="padding:10px; border:1px solid #ccc;">Nakshatra (Charan)</th>
//             <th style="padding:10px; border:1px solid #ccc; background:#ffe6e6;">Sub Lord</th>
//             <th style="padding:10px; border:1px solid #ccc;">Sub-Sub</th>
//           </tr></thead>
//           <tbody>
//             ${kpPlanets
//               .map(
//                 (p) => `
//               <tr>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:600;">${p.planet_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.sign_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.house}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.nakshatra_name} (${p.nakshatra_charan})</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#d35400;">${p.sub_lord}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.sub_sub_lord}</td>
//               </tr>`,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>
//     </div>`;
//   }

//   let kpHousesHTML = "";
//   if (kpHouses.length > 0) {
//     kpHousesHTML = `
//     <div class="mb-8">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">KP House Cusps & Sub-Lords (Placidus)</h3>
//       <div style="overflow-x:auto;">
//         <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:700px;">
//           <thead><tr style="background:#F6CFD5; color:#5E1520;">
//             <th style="padding:10px; border:1px solid #ccc;">House</th>
//             <th style="padding:10px; border:1px solid #ccc;">Sign</th>
//             <th style="padding:10px; border:1px solid #ccc;">Nakshatra (Charan)</th>
//             <th style="padding:10px; border:1px solid #ccc; background:#ffe6e6;">Cusp Sub Lord</th>
//             <th style="padding:10px; border:1px solid #ccc;">Sub-Sub Lord</th>
//           </tr></thead>
//           <tbody>
//             ${kpHouses
//               .map(
//                 (h) => `
//               <tr>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; background:#f9f9f9;">${h.house_id}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.sign_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.nakshatra_name} (${h.nakshatra_charan})</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#d35400;">${h.sub_lord}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.sub_sub_lord}</td>
//               </tr>`,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>
//     </div>`;
//   }

//   let antarDashaHTML = "";
//   if (
//     Object.keys(vimshottri_antar_vdasha_data).length > 0 &&
//     !vimshottri_antar_vdasha_data.error
//   ) {
//     for (const [mahaPlanet, antarList] of Object.entries(
//       vimshottri_antar_vdasha_data,
//     )) {
//       if (!Array.isArray(antarList) || antarList.length === 0) continue;
//       const mahaStart = formatDate(antarList[0]?.start || "-");
//       const mahaEnd = formatDate(antarList[antarList.length - 1]?.end || "-");
//       antarDashaHTML += `
//         <div class="mb-10">
//           <p class="text-[#5E1520] font-bold text-lg mb-3">${mahaPlanet} Mahadasha (${mahaStart} – ${mahaEnd})</p>
//           <table class="w-full text-[13px] border-collapse bg-white rounded">
//             <thead>
//               <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                 <th class="p-2 border border-[#F6CFD5]">Antardasha in ${mahaPlanet}</th>
//                 <th class="p-2 border border-[#F6CFD5]">Start Date</th>
//                 <th class="p-2 border border-[#F6CFD5]">End Date</th>
//               </tr>
//             </thead>
//             <tbody class="text-[#504E4F]">
//               ${antarList
//                 .map(
//                   (antar) => `
//                 <tr>
//                   <td class="p-2 border">${antar.planet || "-"}</td>
//                   <td class="p-2 border">${formatDate(antar.start)}</td>
//                   <td class="p-2 border">${formatDate(antar.end)}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>`;
//     }
//   }

//   // ─────────────────────────────────────────────
//   // SECTION MAP — key: section name → HTML string
//   // ─────────────────────────────────────────────
//   return {
//     // ── 1. COVER PAGE ──
//     cover: `
//       <section class="h-[100vh] py-10" style="background: linear-gradient(180deg, #370c12 0%, #9d2235 100%)">
//         <div><span class="bg-[#FFDBC22E] text-white text-[25px] font-medium px-10 py-4">Logo</span></div>
//         <div class="h-full flex items-center justify-center">
//           <div>
//             <img src="https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/landingPage.png" class="w-[60%] mx-auto" alt="" />
//             <p class="heading_font text-center pt-4 text-[#FF7010] text-[32px]">Vedic Astrology Report</p>
//             <p class="text-center text-[#fff] text-[18px] font-medium">
//               Generated on: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
//             </p>
//           </div>
//         </div>
//       </section>`,

//     // ── 2. WELCOME ──
//     welcome: sectionWrap(`
//       <p class="heading_font text-[18px]">
//         Hey,<br />Welcome to your Kundli Report! <br /><br />
//         Your birth chart holds a unique story about who you are and the journey you're meant to follow. For thousands of years, Vedic Astrology has helped people understand their strengths, challenges, and life direction by studying the positions of planets at the exact moment of birth.<br /><br />
//         It may sound mystical, but it's deeply rooted in astronomy. The movement of celestial bodies—Sun, Moon, and planets—creates energetic patterns that influence our nature, decisions, relationships, career, and overall path in life.<br /><br />
//         In this report, we've used your birth details to create your Kundli, which reveals your Ascendant, Moon Sign, planetary placements, yogas, and the influence of different dashas. Each of these elements offers meaningful insights into your personality, emotions, opportunities, and future possibilities.<br /><br />
//         People use Kundli for many important aspects of life—understanding themselves better, planning relationships, exploring career directions, choosing auspicious moments, or gaining clarity about life events.<br /><br />
//         We hope this detailed Kundli Report gives you deeper self-awareness and helps you navigate your journey with confidence and clarity.<br /><br />
//         Thank you for exploring Vedic Astrology with us!
//       </p>`),

//     // ── 3. BASIC INFO (Birth Details) ──
//     basic_info: sectionWrap(`
//       ${sectionTitle("Basic Information")}
//       <p class="text-center text-[#504E4F] pt-6">The accuracy and quality of your predictions depend almost entirely on the correctness of Birth Details.</p>
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Birth Details Information")}</div>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="flex items-center justify-between pt-4 text-[14px]"><span class="text-[#5E1520] font-medium">Birth Year :</span><span>${birth_details_data.year || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Birth Month :</span><span>${birth_details_data.month || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Birth Date :</span><span>${birth_details_data.day || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Birth Time :</span><span>${birth_details_data.hour || "-"}:${birth_details_data.minute?.toString().padStart(2, "0") || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Latitude :</span><span>${birth_details_data.latitude || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Longitude :</span><span>${birth_details_data.longitude || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Timezone :</span><span>${birth_details_data.timezone || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Ayanamsha :</span><span>${birth_details_data.ayanamsha || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Sunrise :</span><span>${birth_details_data.sunrise || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Sunset :</span><span>${birth_details_data.sunset || "-"}</span></p>
//       </div>`),

//     // ── 4. ASTRO DETAILS ──
//     astro_details: sectionWrap(`
//       <div class="h-[85%]">
//         <div class="flex items-center justify-center mt-10">${sectionTitle("Some More Information")}</div>
//         <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//           <p class="text-[#5E1520] text-center text-[18px] font-medium">Astro Details</p>
//           <hr class="border border-[#F6CFD5] mt-2" />
//           ${[
//             ["Ascendant", astro_details_data.ascendant],
//             ["Ascendant Lord", astro_details_data.ascendant_lord],
//             ["Varna", astro_details_data.Varna],
//             ["Vashya", astro_details_data.Vashya],
//             ["Yoni", astro_details_data.Yoni],
//             ["Gan", astro_details_data.Gan],
//             ["Nadi", astro_details_data.Nadi],
//             ["Sign", astro_details_data.sign],
//             ["Sign Lord", astro_details_data.SignLord],
//             ["Nakshatra", astro_details_data.Naksahtra],
//             ["Nakshatra Lord", astro_details_data.NaksahtraLord],
//             ["Charan", astro_details_data.Charan],
//             ["Yog", astro_details_data.Yog],
//             ["Karan", astro_details_data.Karan],
//             ["Tithi", astro_details_data.Tithi],
//             ["Yunja", astro_details_data.yunja],
//             ["Tatva", astro_details_data.tatva],
//             ["Name Alphabet", astro_details_data.name_alphabet],
//             ["Paya", astro_details_data.paya],
//           ]
//             .map(
//               ([label, val]) => `
//             <p class="flex items-center justify-between pt-2 text-[14px]">
//               <span class="text-[#5E1520] font-medium">${label} :</span>
//               <span>${val || "-"}</span>
//             </p>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 5. CHAUGHADIYA ──
//     chaughadiya: sectionWrap(`
//       ${sectionTitle("Chaughadiya Muhurta")}
//       <div class="h-[85%]">
//         <p class="text-center text-[#504E4F] pt-6">Chaughadiya Muhurta is a traditional time-selection method used in Hindu Astrology to determine whether a particular period of the day or night is favorable or unfavorable for starting important activities.</p>
//         <div class="overflow-x-auto">
//           <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//             <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font"><th class="p-2 border">Period</th><th class="p-2 border">Time</th><th class="p-2 border">Muhurta</th></tr></thead>
//             <tbody>
//               <tr class="bg-[#f9e4e7] font-semibold"><td colspan="3" class="p-2 border text-center">Day Chaughadiya</td></tr>
//               ${chaughadiya_muhurta.chaughadiya?.day?.map((d) => `<tr class="text-[#504E4F]"><td class="p-2 border">Day</td><td class="p-2 border">${d.time}</td><td class="p-2 border">${d.muhurta}</td></tr>`).join("") || ""}
//               <tr class="bg-[#f9e4e7] font-semibold"><td colspan="3" class="p-2 border text-center">Night Chaughadiya</td></tr>
//               ${chaughadiya_muhurta.chaughadiya?.night?.map((n) => `<tr class="text-[#504E4F]"><td class="p-2 border">Night</td><td class="p-2 border">${n.time}</td><td class="p-2 border">${n.muhurta}</td></tr>`).join("") || ""}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 6. AYANAMSHA ──
//     ayanamsha: sectionWrap(`
//       ${sectionTitle("Ayanamsha")}
//       <p class="text-center text-[#504E4F] pt-6">Ayanamsha is an important concept in Hindu Astrology that refers to the angular difference between the tropical zodiac and the sidereal zodiac.</p>
//       <div class="overflow-x-auto">
//         <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//           <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font"><th class="p-2 border">Ayanamsha Type</th><th class="p-2 border">Degree</th><th class="p-2 border">Formatted</th></tr></thead>
//           <tbody>
//             ${(Array.isArray(ayanamsha) ? ayanamsha : [])
//               .map(
//                 (a) => `
//               <tr class="text-[#504E4F]">
//                 <td class="p-2 border">${a.type || "-"}</td>
//                 <td class="p-2 border">${a.degree ? a.degree.toFixed(6) : "-"}</td>
//                 <td class="p-2 border">${a.formatted || "-"}</td>
//               </tr>`,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>`),

//     // ── 7. CHARA DASHA ──
//     chara_dasha: sectionWrap(`
//       ${sectionTitle("Chara Dasha")}
//       <p class="text-center text-[#504E4F] pt-6">Chara Dasha is a predictive timing system used in Jaimini Astrology. It is sign-based, meaning each zodiac sign governs a certain time period in a person's life.</p>
//       <div class="flex flex-wrap gap-4 mt-6">
//         <div class="bg-[#FFF3E0] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//           <p class="font-semibold text-[#FB8C00] text-lg">Major Dasha</p>
//           <div class="mt-2 text-[#504E4F]">
//             <p><span class="font-medium">Sign:</span> ${current_chardasha?.major_dasha?.sign_name || "-"}</p>
//             <p><span class="font-medium">Duration:</span> ${current_chardasha?.major_dasha?.duration || "-"}</p>
//             <p><span class="font-medium">Start Date:</span> ${current_chardasha?.major_dasha?.start_date || "-"}</p>
//             <p><span class="font-medium">End Date:</span> ${current_chardasha?.major_dasha?.end_date || "-"}</p>
//           </div>
//         </div>
//         <div class="bg-[#E1F5FE] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//           <p class="font-semibold text-[#0277BD] text-lg">Sub Dasha</p>
//           <div class="mt-2 text-[#504E4F]">
//             <p><span class="font-medium">Sign:</span> ${current_chardasha?.sub_dasha?.sign_name || "-"}</p>
//             <p><span class="font-medium">Duration:</span> ${current_chardasha?.sub_dasha?.duration || "-"}</p>
//             <p><span class="font-medium">Start Date:</span> ${current_chardasha?.sub_dasha?.start_date || "-"}</p>
//             <p><span class="font-medium">End Date:</span> ${current_chardasha?.sub_dasha?.end_date || "-"}</p>
//           </div>
//         </div>
//         <div class="bg-[#E8F5E9] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//           <p class="font-semibold text-[#2E7D32] text-lg">Sub-Sub Dasha</p>
//           <div class="mt-2 text-[#504E4F]">
//             <p><span class="font-medium">Sign:</span> ${current_chardasha?.sub_sub_dasha?.sign_name || "-"}</p>
//             <p><span class="font-medium">Duration:</span> ${current_chardasha?.sub_sub_dasha?.duration || "-"}</p>
//             <p><span class="font-medium">Start Date:</span> ${current_chardasha?.sub_sub_dasha?.start_date || "-"}</p>
//             <p><span class="font-medium">End Date:</span> ${current_chardasha?.sub_sub_dasha?.end_date || "-"}</p>
//           </div>
//         </div>
//       </div>`),

//     // ── 8. GENERAL HOUSE REPORT ──
//     general_house_report: sectionWrap(`
//       ${sectionTitle("General House Report")}
//       <p class="text-center text-[#504E4F] pt-6">A General House Report explains the significance and influence of the twelve astrological houses in a person's birth chart.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">General House Reports</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         ${Object.values(general_house_report)
//           .map(
//             (item) => `
//           <div class="pt-4">
//             <p class="text-[14px]">
//               <span class="text-[#5E1520] font-medium">${item?.planet}</span><br/>
//               <span>${item?.house_report}</span>
//             </p><br/><br/>
//           </div>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 9. LAL KITAB PLANETS ──
//     lalkitab_planets: sectionWrap(`
//       ${sectionTitle("Lal Kitab Planet")}
//       <p class="text-center text-[#504E4F] pt-6">Lal Kitab Planets refers to the planetary positions and their influences according to the principles of Lal Kitab.</p>
//       <div class="overflow-x-auto w-[80%] mx-auto mt-10 bg-[#FFDBC25C] p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium mb-2">Lal Kitab Planets</p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         <table class="w-full text-[13px] border border-[#e5b8b3] rounded">
//           <thead><tr class="bg-[#F6CFD5] text-[#5E1520] font-medium">
//             <th class="p-2 border">Planet</th><th class="p-2 border">Rashi</th><th class="p-2 border">Soya</th><th class="p-2 border">Position</th><th class="p-2 border">Nature</th>
//           </tr></thead>
//           <tbody>
//             ${(Array.isArray(lalkitab_planets) ? lalkitab_planets : [])
//               .map(
//                 (item) => `
//               <tr class="text-[#504E4F]">
//                 <td class="p-2 border">${item?.planet}</td>
//                 <td class="p-2 border">${item?.rashi}</td>
//                 <td class="p-2 border">${item?.soya ? "Yes" : "No"}</td>
//                 <td class="p-2 border">${item?.position}</td>
//                 <td class="p-2 border">${item?.nature}</td>
//               </tr>`,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>`),

//     // ── 10. HORA MUHURTA ──
//     hora_muhurta: sectionWrap(`
//       ${sectionTitle("Hora Muhurta")}
//       <p class="text-center text-[#504E4F] pt-6">Hora Muhurta is a system in Vedic astrology used to select favorable hours of the day for performing important activities.</p>
//       <div class="overflow-x-auto w-[90%] mx-auto mt-10 p-4 bg-[#FFDBC25C] rounded-lg">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Hora Muhurta</p>
//         <hr class="border border-[#F6CFD5] my-2" />
//         <p class="text-[#5E1520] font-medium mt-2 mb-1">Day Horas</p>
//         <table class="w-full text-[12px] border border-[#e5b8b3] rounded mb-4">
//           <thead><tr class="bg-[#F6CFD5] text-[#5E1520]"><th class="p-2 border">Time</th><th class="p-2 border">Hora (Planet)</th></tr></thead>
//           <tbody>${dayHoras.map((item) => `<tr><td class="p-2 border">${item?.time?.replace(":", " - ")}</td><td class="p-2 border">${item?.hora}</td></tr>`).join("")}</tbody>
//         </table>
//         <p class="text-[#5E1520] font-medium mt-2 mb-1">Night Horas</p>
//         <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//           <thead><tr class="bg-[#F6CFD5] text-[#5E1520]"><th class="p-2 border">Time</th><th class="p-2 border">Hora (Planet)</th></tr></thead>
//           <tbody>${nightHoras.map((item) => `<tr><td class="p-2 border">${item?.time?.replace(":", " - ")}</td><td class="p-2 border">${item?.hora}</td></tr>`).join("")}</tbody>
//         </table>
//       </div>`),

//     // ── 11. GHAT CHAKRA ──
//     ghat_chakra: sectionWrap(`
//       ${sectionTitle("The Ghat Chakra")}
//       <p class="text-center text-[#504E4F] pt-6">The Ghat Chakra divides the day and night into precise time segments for selecting auspicious periods for various activities.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Ghat Chakra Details</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         ${Object.entries(ghat_chakra)
//           .map(
//             ([key, value]) => `
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium capitalize">${key} :</span>
//             <span>${value}</span>
//           </p>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 12. PLANET NATURE ──
//     planet_nature: sectionWrap(`
//       ${sectionTitle("Planet Nature")}
//       <p class="text-center text-[#504E4F] pt-6">Planet Nature refers to the inherent qualities of each planet that influence human behavior, events, and outcomes in life.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Planet Nature in Astrology</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         ${Object.entries(planet_nature || {})
//           .map(
//             ([key, value]) => `
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">${key.charAt(0) + key.slice(1).toLowerCase()} Planets :</span>
//             <span>${(value || []).join(", ")}</span>
//           </p>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 13. GENERAL RASHI REPORT (part 1 - first 3) ──
//     general_rashi_1: sectionWrap(`
//       ${sectionTitle("The General Rashi Report")}
//       <p class="text-center text-[#504E4F] pt-6">The General Rashi Report provides a broad interpretation of how zodiac signs affect the native's life based on planetary placements.</p>
//       <div class="w-[90%] mx-auto mt-10">
//         <p class="text-[#5E1520] text-center text-[20px] font-semibold mb-4">General Rashi Report</p>
//         ${Object.values(general_rashi_report)
//           .slice(0, 3)
//           .map(
//             (item) => `
//           <div class="bg-[#FFDBC25C] p-6 rounded-[11px] mb-6">
//             <p class="text-[#5E1520] text-[16px] font-semibold">${item.planet}</p>
//             <hr class="border border-[#F6CFD5] my-2" />
//             <p class="text-[#504E4F] text-[14px] leading-relaxed">${item.rashi_report}</p>
//           </div>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 14. GENERAL RASHI REPORT (part 2 - rest) ──
//     general_rashi_2: sectionWrap(`
//       <div class="w-[90%] mx-auto mt-10">
//         <p class="text-[#5E1520] text-center text-[20px] font-semibold mb-4">General Rashi Report</p>
//         ${Object.values(general_rashi_report)
//           .slice(3)
//           .map(
//             (item) => `
//           <div class="bg-[#FFDBC25C] p-6 rounded-[11px] mb-6">
//             <p class="text-[#5E1520] text-[16px] font-semibold">${item.planet}</p>
//             <hr class="border border-[#F6CFD5] my-2" />
//             <p class="text-[#504E4F] text-[14px] leading-relaxed">${item.rashi_report}</p>
//           </div>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 15. PANCHANG ──
//     panchang: sectionWrap(`
//       ${sectionTitle("Panchang")}
//       <p class="text-center text-[#504E4F] pt-6">Panchang describes the five key elements that define the energy of any given day — Tithi, Nakshatra, Yoga, Karana, and Vaar.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Panchang Details</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         ${[
//           ["Day", basic_panchang_data.day],
//           ["Tithi", basic_panchang_data.tithi],
//           ["Nakshatra", basic_panchang_data.nakshatra],
//           ["Yog", basic_panchang_data.yog],
//           ["Karan", basic_panchang_data.karan],
//           ["Sunrise", basic_panchang_data.sunrise],
//           ["Sunset", basic_panchang_data.sunset],
//           ["Vedic Sunrise", basic_panchang_data.vedic_sunrise],
//           ["Vedic Sunset", basic_panchang_data.vedic_sunset],
//         ]
//           .map(
//             ([label, val]) => `
//           <p class="flex items-center justify-between pt-4 text-[14px]">
//             <span class="text-[#5E1520] font-medium">${label} :</span>
//             <span>${val || "-"}</span>
//           </p>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 16. CHARTS (set 1) ──
//     charts_1: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Janma Kundli / Navamansha Chart / Other Charts")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Birth Chart (Janma Kundli) is the primary chart in Vedic Astrology, representing exact planetary positions at the moment of birth.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-center text-[#5E1520] text-[18px] font-medium mb-4">Astrological Charts</p>
//         <hr class="border border-[#F6CFD5] mb-6" />
//         <div class="flex items-center justify-around gap-4 flex-wrap">
//           ${[
//             [birth_chart_data, "Birth Chart"],
//             [moon_chart, "Moon Chart"],
//             [vishamansha_chart, "Vishamansha Chart"],
//             [panchmansha_chart, "Panchmansha Chart"],
//             [shodashamsha_chart, "Shodashamsha Chart"],
//             [hora_chart, "Hora Chart"],
//             [bhamsha_chart, "Bhamsha Chart"],
//             [trishamansha_chart, "Trishamansha Chart"],
//           ]
//             .filter(([chart]) => chart?.status === true)
//             .map(
//               ([chart, name]) => `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">${name}</p>
//                 <img src="${chart.chart_url}" alt="${name}" class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md" />
//               </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 17. CHARTS (set 2) ──
//     charts_2: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Janma Kundli / Navamansha Chart / Other Charts")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Navamansha Chart (D9) is one of the most powerful divisional charts in Vedic Astrology showing the inner strength and true potential of planets.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-center text-[#5E1520] text-[18px] font-medium mb-4">Astrological Charts</p>
//         <hr class="border border-[#F6CFD5] mb-6" />
//         <div class="flex items-center justify-around gap-4 flex-wrap">
//           ${[
//             [chathurthamasha_chart, "Chathurthamasha Chart"],
//             [sun_chart, "Sun Chart"],
//             [saptamansha_chart_data, "Saptamansha Chart"],
//             [dwadashamsha_chart, "Dwadashamsha Chart"],
//             [ashtamansha_chart, "Ashtamansha Chart"],
//             [akshvedansha_chart, "Akshvedansha Chart"],
//             [navamansha_chart_data, "Navamansha Chart"],
//             [chalit_chart_data, "Chalit Chart"],
//             [chaturvimshamsha_chart, "Chaturvimshamsha Chart"],
//             [dashamansha_chart_data, "Dashamansha Chart"],
//           ]
//             .filter(([chart]) => chart?.status === true)
//             .map(
//               ([chart, name]) => `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">${name}</p>
//                 <img src="${chart.chart_url}" alt="${name}" class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md" />
//               </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 18. HORA MUHURTA DINMAN ──
//     hora_muhurta_dinman: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Hora Muhurta Dinman")}</div>
//       <p class="text-center text-[#504E4F] pt-6">Hora Muhurta Dinman refers to the division of the day and night into planetary hours in Vedic astrology.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Hora Muhurta Dinman</p>
//         <hr class="border border-[#F6CFD5] mt-2 mb-4" />
//         <p class="text-[#5E1520] font-medium mb-2">🌞 Day Horas</p>
//         <div class="overflow-x-auto">
//           <table class="w-full text-[14px] border-collapse">
//             <thead><tr class="bg-[#F6CFD5] text-[#5E1520]"><th class="border px-2 py-1">Hora</th><th class="border px-2 py-1">Time</th></tr></thead>
//             <tbody>${dayHorasmuhurta_dinman.map((item) => `<tr><td class="p-2 border">${item?.time?.replace(":", " - ") || "-"}</td><td class="p-2 border">${item?.hora || "-"}</td></tr>`).join("")}</tbody>
//           </table>
//         </div>
//         <p class="text-[#5E1520] font-medium mt-4 mb-2">🌙 Night Horas</p>
//         <div class="overflow-x-auto">
//           <table class="w-full text-[14px] border-collapse">
//             <thead><tr class="bg-[#F6CFD5] text-[#5E1520]"><th class="border px-2 py-1">Hora</th><th class="border px-2 py-1">Time</th></tr></thead>
//             <tbody>${(nightHorasmuhurta_dinman || []).map((item) => `<tr><td class="border px-2 py-1">${item?.hora || "-"}</td><td class="border px-2 py-1">${item?.time || "-"}</td></tr>`).join("")}</tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 19. JAIMINI DETAILS ──
//     jaimini_details: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Jaimini Details")}</div>
//       <p class="text-center text-[#504E4F] pt-6">Jaimini astrology focuses on special karakas and predictive techniques.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Jaimini Details</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Janma Lagna:</span><span>${jaimini_details?.janma_lagna || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Pad Lagna:</span><span>${jaimini_details?.pad_lagna || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Up Pad Lagna:</span><span>${jaimini_details?.up_pad_lagna || "-"}</span></p>
//         <p class="flex items-center justify-between pt-2 text-[14px]"><span class="text-[#5E1520] font-medium">Kakamsha Lagna:</span><span>${jaimini_details?.kakamsha_lagna || "-"}</span></p>
//         <p class="text-[#5E1520] font-medium pt-4">Jaimini Karakas:</p>
//         ${Object.entries(karakas || {})
//           .map(
//             ([key, value]) => `
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:</span>
//             <span>${value?.planet_name || "-"} (${value?.sign || "-"}) - ${value?.degree ? value.degree.toFixed(2) : "-"}°</span>
//           </p>`,
//           )
//           .join("")}
//       </div>`),

//     // ── 20. PANCHANG CHART ──
//     panchang_chart: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("The Panchang Chart")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Panchang Chart shows the placement of planets in the zodiac signs for a given date and time.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Panchang Chart</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="pt-4 space-y-3">
//           ${(Array.isArray(panchang_chart) ? panchang_chart : [])
//             .map((item) => {
//               const planets =
//                 item?.planet?.length > 0
//                   ? `${item.planet.join(", ")} (${item?.planet_small?.join("").trim()})`
//                   : "-";
//               return `
//               <div class="flex items-center justify-between text-[14px]">
//                 <span class="text-[#5E1520] font-medium">${item.sign_name} (Sign ${item.sign}):</span>
//                 <span>${planets}</span>
//               </div>`;
//             })
//             .join("")}
//         </div>
//       </div>`),

//     // ── 21. PANCHANG HORA MUHURTA DINMAN ──
//     panchang_hora_muhurta_dinman: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Panchang Hora Muhurta Dinman")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Panchang Hora Muhurta Dinman displays the planetary hours (Horas) for both day and night.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Panchang Hora Muhurta Dinman</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <p class="text-[#5E1520] font-medium mt-4">Day Horas</p>
//         <div class="pt-2 space-y-2">
//           ${dayHorasPanchnag.map((item) => `<div class="flex justify-between text-[14px]"><span>${item.hora}</span><span>${item.time}</span></div>`).join("")}
//         </div>
//         <p class="text-[#5E1520] font-medium mt-4">Night Horas</p>
//         <div class="pt-2 space-y-2">
//           ${nightHorasPanchnag.map((item) => `<div class="flex justify-between text-[14px]"><span>${item.hora}</span><span>${item.time}</span></div>`).join("")}
//         </div>
//       </div>`),

//     // ── 22. PANCHANG LAGNA TABLE ──
//     panchang_lagna_table: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Panchang Lagna Table")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Panchang Lagna Table lists the sequence of Lagna (ascendant signs) with their start and end times.</p>
//       <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#006064] text-center text-[18px] font-medium">Panchang Lagna Table</p>
//         <hr class="border border-[#B2EBF2] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full table-auto border-collapse border border-[#B2EBF2]">
//             <thead><tr class="bg-[#B2EBF2]">
//               <th class="border border-[#81D4FA] px-4 py-2 text-left">Lagna</th>
//               <th class="border border-[#81D4FA] px-4 py-2 text-left">Start Time</th>
//               <th class="border border-[#81D4FA] px-4 py-2 text-left">End Time</th>
//             </tr></thead>
//             <tbody>
//               ${(Array.isArray(panchang_lagna_table)
//                 ? panchang_lagna_table
//                 : []
//               )
//                 .map(
//                   (item) => `
//                 <tr class="hover:bg-[#E0F2F1]">
//                   <td class="border border-[#81D4FA] px-4 py-2">${item.lagna}</td>
//                   <td class="border border-[#81D4FA] px-4 py-2">${item.start_time}</td>
//                   <td class="border border-[#81D4FA] px-4 py-2">${item.end_time}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 23. PLANET PANCHANG ──
//     planet_panchang: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Planet Panchang")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Planet Panchang table provides detailed positions of all major planets and the ascendant at a given time.</p>
//       <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#E65100] text-center text-[18px] font-medium">Planet Panchang</p>
//         <hr class="border border-[#FFCC80] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full table-auto border-collapse border border-[#FFCC80]">
//             <thead><tr class="bg-[#FFCC80]">
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Planet</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Sign</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Sign Lord</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra Lord</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra Pad</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">House</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Degree</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Retrograde</th>
//               <th class="border border-[#FFD180] px-4 py-2 text-left">Speed</th>
//             </tr></thead>
//             <tbody>
//               ${(Array.isArray(planet_panchang) ? planet_panchang : [])
//                 .map(
//                   (planet) => `
//                 <tr class="hover:bg-[#FFE0B2]">
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.name}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.sign}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.signLord}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.nakshatra}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.nakshatra_lord}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.nakshatra_pad}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.house}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.fullDegree?.toFixed(3)}°</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${String(planet.isRetro) === "true" ? "Yes" : "No"}</td>
//                   <td class="border border-[#FFD180] px-4 py-2">${planet.speed?.toFixed(3)}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 24. MONTHLY PANCHANG ──
//     monthly_panchang: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Monthly Panchang")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Monthly Panchang shows the detailed daily Panchang for a specific month and year.</p>
//       <div class="bg-[#E3F2FD] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#1976D2] text-center text-[18px] font-medium">Monthly Panchang - ${monthly_panchang?.month}/${monthly_panchang?.year}</p>
//         <hr class="border border-[#64B5F6] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full table-auto border-collapse border border-[#64B5F6]">
//             <thead><tr class="bg-[#64B5F6] text-white">
//               <th class="border border-[#BBDEFB] px-4 py-2">Day</th>
//               <th class="border border-[#BBDEFB] px-4 py-2">Tithi</th>
//               <th class="border border-[#BBDEFB] px-4 py-2">Nakshatra</th>
//               <th class="border border-[#BBDEFB] px-4 py-2">Sunrise</th>
//               <th class="border border-[#BBDEFB] px-4 py-2">Sunset</th>
//             </tr></thead>
//             <tbody>
//               ${panchangList
//                 .map(
//                   (item) => `
//                 <tr class="hover:bg-[#BBDEFB]">
//                   <td class="border border-[#BBDEFB] px-4 py-2">${item.day}</td>
//                   <td class="border border-[#BBDEFB] px-4 py-2">${item.tithi}</td>
//                   <td class="border border-[#BBDEFB] px-4 py-2">${item.nak}</td>
//                   <td class="border border-[#BBDEFB] px-4 py-2">${item.sunrise}</td>
//                   <td class="border border-[#BBDEFB] px-4 py-2">${formatTime(item.sunSetTime)}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 25. ADVANCED PANCHANG ──
//     advanced_panchang: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Advanced Panchang")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Advanced Panchang section provides a detailed overview of the day according to Vedic astrology.</p>
//       <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#006064] text-center text-[18px] font-medium">Advanced Panchang</p>
//         <hr class="border border-[#B2EBF2] mt-2" />
//         <div class="mt-4">
//           <p class="text-[#006064] font-semibold">Day & Timings:</p>
//           <p class="text-[#006064] mt-1">Day: ${advanced_panchang.day}</p>
//           <p class="text-[#006064] mt-1">Sunrise: ${advanced_panchang.sunrise} | Sunset: ${advanced_panchang.sunset}</p>
//           <p class="text-[#006064] mt-1">Moonrise: ${advanced_panchang.moonrise} | Moonset: ${advanced_panchang.moonset}</p>
//           <p class="text-[#006064] mt-1">Vedic Sunrise: ${advanced_panchang.vedic_sunrise} | Vedic Sunset: ${advanced_panchang.vedic_sunset}</p>
//           <div class="mt-4">
//             <p class="text-[#006064] font-semibold">Tithi:</p>
//             <p class="text-[#006064] mt-1">${tithi.tithi_name} (${tithi.special}) - ${tithi.summary} Deity: ${tithi.deity}</p>
//             <p class="text-[#006064] font-semibold mt-2">Nakshatra:</p>
//             <p class="text-[#006064] mt-1">${nakshatra.nak_name} - ${nakshatra.summary} Ruler: ${nakshatra.ruler}, Deity: ${nakshatra.deity}</p>
//             <p class="text-[#006064] font-semibold mt-2">Yog:</p>
//             <p class="text-[#006064] mt-1">${yog.yog_name} - ${yog.special} Meaning: ${yog.meaning}</p>
//             <p class="text-[#006064] font-semibold mt-2">Karan:</p>
//             <p class="text-[#006064] mt-1">${karan.karan_name} - ${karan.special} Deity: ${karan.deity}</p>
//             <p class="text-[#006064] font-semibold mt-2">Other Panchang Details:</p>
//             <p class="text-[#006064] mt-1">Hindu Maah: ${hinduMaah.purnimanta} (Purnimanta & Amanta)</p>
//             <p class="text-[#006064] mt-1">Paksha: ${advanced_panchang.paksha} | Ritu: ${advanced_panchang.ritu} | Sun Sign: ${advanced_panchang.sun_sign} | Moon Sign: ${advanced_panchang.moon_sign} | Ayana: ${advanced_panchang.ayana} | Panchang Yog: ${advanced_panchang.panchang_yog}</p>
//             <p class="text-[#006064] mt-1">Vikram Samvat: ${advanced_panchang.vikram_samvat} (${advanced_panchang.vkram_samvat_name}) | Shaka Samvat: ${advanced_panchang.shaka_samvat} (${advanced_panchang.shaka_samvat_name})</p>
//             <p class="text-[#006064] mt-1">Disha Shool: ${advanced_panchang.disha_shool} | Moon Nivas: ${advanced_panchang.moon_nivas}</p>
//             <p class="text-[#006064] font-semibold mt-2">Auspicious & Inauspicious Timings:</p>
//             <p class="text-[#006064] mt-1">Abhijit Muhurta: ${advanced_panchang?.abhijit_muhurta?.start} - ${advanced_panchang?.abhijit_muhurta?.end}</p>
//             <p class="text-[#006064] mt-1">Gulik Kaal: ${advanced_panchang?.guliKaal?.start} - ${advanced_panchang?.guliKaal?.end}</p>
//             <p class="text-[#006064] mt-1">Yamghant Kaal: ${advanced_panchang?.yamghant_kaal?.start} - ${advanced_panchang?.yamghant_kaal?.end}</p>
//           </div>
//         </div>
//       </div>`),

//     // ── 26. PLANETS ──
//     planets: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Planets")}</div>
//       <p class="text-center text-[#504E4F] pt-6">In Vedic astrology, planets are known as Grahas — the primary forces that shape human life, destiny, and personality.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">Planets in Your Kundli</p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         ${
//           planets_data.length > 0
//             ? `
//         <div class="overflow-x-auto">
//           <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//             <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//               <th class="p-2 border">Planet</th><th class="p-2 border">Sign</th><th class="p-2 border">Degree</th>
//               <th class="p-2 border">Sign Lord</th><th class="p-2 border">Nakshatra</th><th class="p-2 border">Nakshatra Lord</th>
//               <th class="p-2 border">Nakshatra Pad</th><th class="p-2 border">House</th><th class="p-2 border">Planet Awastha</th><th class="p-2 border">Retrograde</th>
//             </tr></thead>
//             <tbody>
//               ${planets_data
//                 .filter(
//                   (p) =>
//                     p.name !== "Ascendant" &&
//                     !["URANUS", "NEPTUNE", "PLUTO"].includes(p.name),
//                 )
//                 .map(
//                   (p) => `
//                 <tr class="text-[#504E4F]">
//                   <td class="p-2 border">${p.name || "-"}</td>
//                   <td class="p-2 border">${p.sign || "-"}</td>
//                   <td class="p-2 border">${p.fullDegree ? p.fullDegree.toFixed(4) : "-"}</td>
//                   <td class="p-2 border">${p.signLord || "-"}</td>
//                   <td class="p-2 border">${p.nakshatra || "-"}</td>
//                   <td class="p-2 border">${p.nakshatraLord || "-"}</td>
//                   <td class="p-2 border">${p.nakshatra_pad || "-"}</td>
//                   <td class="p-2 border">${p.house || "-"}</td>
//                   <td class="p-2 border">${p.planet_awastha || "-"}</td>
//                   <td class="p-2 border">${p.isRetro || "-"}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>`
//             : ""
//         }
//       </div>`),

//     // ── 27. LAL KITAB REMEDIES (set 1) ──
//     lalkitab_remedies_1: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Lalkitab Remedies")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Lal Kitab Remedies system prescribes simple actions or rituals to counteract negative effects of planets.</p>
//       <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#FB8C00] text-center text-[18px] font-medium">Lal Kitab Remedies</p>
//         <hr class="border border-[#FFB74D] mt-2" />
//         <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           ${Object.values(lalkitab_remedies)
//             .slice(0, 4)
//             .map(
//               (planetData) => `
//             <div class="bg-[#FFE0B2] p-4 rounded-lg shadow-md">
//               <p class="font-semibold text-[#E65100]">${planetData?.planet} - ${planetData?.house} House</p>
//               <p class="mt-2">${planetData?.lal_kitab_desc}</p>
//               <ul class="list-disc pl-5 mt-2">
//                 ${planetData?.lal_kitab_remedies?.map((remedy) => `<li>${remedy}</li>`).join("")}
//               </ul>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 28. LAL KITAB REMEDIES (set 2) ──
//     lalkitab_remedies_2: sectionWrap(`
//       <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#FB8C00] text-center text-[18px] font-medium">Lal Kitab Remedies</p>
//         <hr class="border border-[#FFB74D] mt-2" />
//         <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           ${Object.values(lalkitab_remedies)
//             .slice(4)
//             .map(
//               (planetData) => `
//             <div class="bg-[#FFE0B2] p-4 rounded-lg shadow-md">
//               <p class="font-semibold text-[#E65100]">${planetData?.planet} - ${planetData?.house} House</p>
//               <p class="mt-2">${planetData?.lal_kitab_desc}</p>
//               <ul class="list-disc pl-5 mt-2">
//                 ${planetData?.lal_kitab_remedies?.map((remedy) => `<li>${remedy}</li>`).join("")}
//               </ul>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 29. LAL KITAB HOROSCOPE ──
//     lalkitab_horoscope: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Lalkitab Horoscope")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Lal Kitab Horoscope shows the position of planets in the 12 zodiac signs according to the Lal Kitab system.</p>
//       <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Lal Kitab Horoscope</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4">
//           <table class="w-full text-left border-collapse">
//             <thead><tr class="bg-[#F6CFD5]">
//               <th class="border px-3 py-2">Sign</th><th class="border px-3 py-2">Planets</th><th class="border px-3 py-2">Short Forms</th>
//             </tr></thead>
//             <tbody>
//               ${(Array.isArray(lalkitab_horoscope) ? lalkitab_horoscope : [])
//                 .map(
//                   (item) => `
//                 <tr>
//                   <td class="border px-3 py-2">${item?.sign_name}</td>
//                   <td class="border px-3 py-2">${item?.planet?.length ? item.planet.join(", ") : "-"}</td>
//                   <td class="border px-3 py-2">${item?.planet_small?.length ? item.planet_small.join(", ") : "-"}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 30. SARVASHTAK ──
//     sarvashtak: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Sarvashtak")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Sarvashtak Varga assesses planetary strengths across the 12 zodiac signs.</p>
//       <div class="bg-[#FFDBC25C] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Sarvashtak Varga</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full text-left border-collapse">
//             <thead><tr class="bg-[#F6CFD5]">
//               <th class="border px-2 py-2">Sign</th><th class="border px-2 py-2">Sun</th><th class="border px-2 py-2">Moon</th>
//               <th class="border px-2 py-2">Mars</th><th class="border px-2 py-2">Mercury</th><th class="border px-2 py-2">Jupiter</th>
//               <th class="border px-2 py-2">Venus</th><th class="border px-2 py-2">Saturn</th><th class="border px-2 py-2">Ascendant</th><th class="border px-2 py-2">Total</th>
//             </tr></thead>
//             <tbody>
//               ${Object.entries(ashtakPoints)
//                 .map(
//                   ([sign, value]) => `
//                 <tr>
//                   <td class="border px-2 py-1 capitalize">${sign}</td>
//                   <td class="border px-2 py-1">${value.sun}</td><td class="border px-2 py-1">${value.moon}</td>
//                   <td class="border px-2 py-1">${value.mars}</td><td class="border px-2 py-1">${value.mercury}</td>
//                   <td class="border px-2 py-1">${value.jupiter}</td><td class="border px-2 py-1">${value.venus}</td>
//                   <td class="border px-2 py-1">${value.saturn}</td><td class="border px-2 py-1">${value.ascendant}</td>
//                   <td class="border px-2 py-1 font-semibold">${value.total}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 31. BHAV MADHYA ──
//     bhav_madhya: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Bhav Madhya")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Bhav Madhya represents the midpoints of the twelve astrological houses in a horoscope.</p>
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Bhav Madhya & Sandhi</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full text-left border-collapse">
//             <thead><tr class="bg-[#F6CFD5]">
//               <th class="border px-2 py-2">House</th><th class="border px-2 py-2">Sign</th><th class="border px-2 py-2">Degree</th><th class="border px-2 py-2">Normalized Degree</th>
//             </tr></thead>
//             <tbody>
//               ${madhyaList
//                 .map(
//                   (item) => `
//                 <tr><td class="border px-2 py-1">${item.house}</td><td class="border px-2 py-1">${item.sign}</td><td class="border px-2 py-1">${item.degree.toFixed(2)}°</td><td class="border px-2 py-1">${item.norm_degree.toFixed(2)}°</td></tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//           <p class="mt-6 text-[#5E1520] font-medium text-[16px]">Bhav Sandhi (Cusp Transitions)</p>
//           <table class="w-full text-left border-collapse mt-2">
//             <thead><tr class="bg-[#F6CFD5]">
//               <th class="border px-2 py-2">House</th><th class="border px-2 py-2">Sign</th><th class="border px-2 py-2">Degree</th><th class="border px-2 py-2">Normalized Degree</th>
//             </tr></thead>
//             <tbody>
//               ${sandhiList
//                 .map(
//                   (item) => `
//                 <tr><td class="border px-2 py-1">${item.house}</td><td class="border px-2 py-1">${item.sign}</td><td class="border px-2 py-1">${item.degree.toFixed(2)}°</td><td class="border px-2 py-1">${item.norm_degree.toFixed(2)}°</td></tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     // ── 32. MOON BIORHYTHM ──
//     moon_biorhythm: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Moon Biorhythm")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Moon Biorhythm represents the daily activity cycle based on the native's birth Pakshi (Moon bird).</p>
//       <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#006064] text-center text-[18px] font-medium">Moon Biorhythm</p>
//         <hr class="border border-[#4DD0E1] mt-2" />
//         <div class="mt-4">
//           <p class="text-[#006064] font-semibold">Birth Pakshi</p>
//           <p class="text-[#006064] mt-1">
//             <span class="font-medium">Name:</span> ${moon_biorhythm.birth_pakshi}<br/>
//             <span class="font-medium">Color:</span> ${moon_biorhythm.birth_pakshi_details?.color}<br/>
//             <span class="font-medium">Direction:</span> ${moon_biorhythm.birth_pakshi_details?.direction}<br/>
//             <span class="font-medium">Friendly Birds:</span> ${moon_biorhythm.birth_pakshi_details?.friend?.join(", ")}<br/>
//             <span class="font-medium">Enemy Birds:</span> ${moon_biorhythm.birth_pakshi_details?.enemy?.join(", ")}<br/>
//             <span class="font-medium">Name Letters:</span> ${moon_biorhythm.birth_pakshi_details?.name_letter?.join(", ")}<br/>
//             <span class="font-medium">Death Days:</span> ${moon_biorhythm.birth_pakshi_details?.death_day?.join(", ")}<br/>
//             <span class="font-medium">Day Ruling Days:</span> ${moon_biorhythm.birth_pakshi_details?.day_ruling_days?.join(", ")}<br/>
//             <span class="font-medium">Night Ruling Days:</span> ${moon_biorhythm.birth_pakshi_details?.night_ruling_days?.join(", ")}
//           </p>
//           <div class="mt-4 overflow-x-auto">
//             <table class="w-full table-auto border-collapse border border-[#4DD0E1]">
//               <thead><tr class="bg-[#4DD0E1]">
//                 <th class="border border-[#B2EBF2] px-4 py-2 text-left">Time Period</th>
//                 <th class="border border-[#B2EBF2] px-4 py-2 text-left">Activity</th>
//                 <th class="border border-[#B2EBF2] px-4 py-2 text-left">Meaning</th>
//                 <th class="border border-[#B2EBF2] px-4 py-2 text-left">Start Time</th>
//                 <th class="border border-[#B2EBF2] px-4 py-2 text-left">End Time</th>
//               </tr></thead>
//               <tbody>
//                 ${
//                   moon_biorhythm?.activity_cycle?.day
//                     ?.map(
//                       (item) => `
//                   <tr class="hover:bg-[#B2EBF2]">
//                     <td class="border border-[#B2EBF2] px-4 py-2">Day</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.activity}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.activity_meaning}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.start_time}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.end_time}</td>
//                   </tr>`,
//                     )
//                     .join("") || ""
//                 }
//                 ${
//                   moon_biorhythm?.activity_cycle?.night
//                     ?.map(
//                       (item) => `
//                   <tr class="hover:bg-[#B2EBF2]">
//                     <td class="border border-[#B2EBF2] px-4 py-2">Night</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.activity}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.activity_meaning}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.start_time}</td>
//                     <td class="border border-[#B2EBF2] px-4 py-2">${item.end_time}</td>
//                   </tr>`,
//                     )
//                     .join("") || ""
//                 }
//               </tbody>
//             </table>
//           </div>
//           <p class="text-[#006064] mt-2 text-right"><span class="font-medium">Date Considered:</span> ${moon_biorhythm.considered_date}</p>
//         </div>
//       </div>`),

//     // ── 33. LAL KITAB DEBTS ──
//     lalkitab_debts: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Lalkitab Debts")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Lalkitab Debts section describes karmic obligations a native may carry according to Vedic astrology.</p>
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Lalkitab Debts</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4">
//           ${(lalkitab_debts || [])
//             .map(
//               (debt) => `
//             <div class="mb-4">
//               <p class="text-[#5E1520] font-semibold">${debt.debt_name || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Indications:</span> ${debt.indications || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Events:</span> ${debt.events || "-"}</p>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 34. LAL KITAB HOUSES (set 1: 0–3) ──
//     lalkitab_houses_1: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Lalkitab Houses")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Lalkitab Houses section provides detailed overview of the twelve houses in a horoscope.</p>
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Lalkitab Houses</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4 space-y-6">
//           ${(lalkitab_houses || [])
//             .slice(0, 4)
//             .map(
//               (house) => `
//             <div class="mb-4 border-b border-[#F6CFD5] pb-4">
//               <p class="text-[#5E1520] font-semibold">House ${house.khana_number || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Maalik:</span> ${house.maalik || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Pakka Ghar:</span> ${house.pakka_ghar || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Kismat:</span> ${house.kismat || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Soya:</span> ${house.soya ? "Yes" : "No"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Exalted:</span> ${Array.isArray(house.exalt) ? house.exalt.join(", ") : house.exalt || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Debilitated:</span> ${Array.isArray(house.debilitated) ? house.debilitated.join(", ") : house.debilitated || "-"}</p>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 35. LAL KITAB HOUSES (set 2: 4–7) ──
//     lalkitab_houses_2: sectionWrap(`
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Lalkitab Houses</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4 space-y-6">
//           ${(lalkitab_houses || [])
//             .slice(4, 8)
//             .map(
//               (house) => `
//             <div class="mb-4 border-b border-[#F6CFD5] pb-4">
//               <p class="text-[#5E1520] font-semibold">House ${house.khana_number || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Maalik:</span> ${house.maalik || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Pakka Ghar:</span> ${house.pakka_ghar || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Kismat:</span> ${house.kismat || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Soya:</span> ${house.soya ? "Yes" : "No"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Exalted:</span> ${Array.isArray(house.exalt) ? house.exalt.join(", ") : house.exalt || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Debilitated:</span> ${Array.isArray(house.debilitated) ? house.debilitated.join(", ") : house.debilitated || "-"}</p>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 36. LAL KITAB HOUSES (set 3: 8+) ──
//     lalkitab_houses_3: sectionWrap(`
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">Lalkitab Houses</p>
//         <hr class="border border-[#F6CFD5] mt-2" />
//         <div class="mt-4 space-y-6">
//           ${(lalkitab_houses || [])
//             .slice(8)
//             .map(
//               (house) => `
//             <div class="mb-4 border-b border-[#F6CFD5] pb-4">
//               <p class="text-[#5E1520] font-semibold">House ${house.khana_number || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Maalik:</span> ${house.maalik || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Pakka Ghar:</span> ${house.pakka_ghar || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Kismat:</span> ${house.kismat || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Soya:</span> ${house.soya ? "Yes" : "No"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Exalted:</span> ${Array.isArray(house.exalt) ? house.exalt.join(", ") : house.exalt || "-"}</p>
//               <p class="text-[#5E1520] mt-1"><span class="font-medium">Debilitated:</span> ${Array.isArray(house.debilitated) ? house.debilitated.join(", ") : house.debilitated || "-"}</p>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 37. DAILY NAKSHATRA PREDICTION ──
//     daily_nakshatra: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Daily Nakshatra Prediction")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Daily Nakshatra Prediction provides personalized guidance based on the Moon sign and Nakshatra of birth.</p>
//       <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#00796B] text-center text-[18px] font-medium">Daily Nakshatra Prediction</p>
//         <hr class="border border-[#B2DFDB] mt-2" />
//         <div class="mt-4">
//           <p class="text-[#00796B] font-semibold">Birth Moon Sign:</p>
//           <p class="text-[#00796B] mt-1">${daily_nakshatra_prediction?.birth_moon_sign || "-"}</p>
//           <p class="text-[#00796B] font-semibold mt-3">Birth Moon Nakshatra:</p>
//           <p class="text-[#00796B] mt-1">${daily_nakshatra_prediction?.birth_moon_nakshatra || "-"}</p>
//           <p class="text-[#00796B] font-semibold mt-3">Prediction Date:</p>
//           <p class="text-[#00796B] mt-1">${daily_nakshatra_prediction?.prediction_date || "-"}</p>
//           ${[
//             "health",
//             "emotions",
//             "profession",
//             "luck",
//             "personal_life",
//             "travel",
//           ]
//             .map(
//               (key) => `
//             <div class="mt-4">
//               <p class="text-[#00796B] font-semibold">${key.charAt(0).toUpperCase() + key.slice(1).replace("_", " ")}</p>
//               <p class="text-[#00796B] mt-1">${prediction?.[key] || "-"}</p>
//             </div>`,
//             )
//             .join("")}
//         </div>
//       </div>`),

//     // ── 38. VIMSHOTTARI DASHA ──
//     vimshottari_dasha: sectionWrap(`
//       <div class="flex items-center justify-center">${sectionTitle("Vimshottari Dasha")}</div>
//       <p class="text-center text-[#504E4F] pt-6">Vimshottari Dasha is the most widely used Dasha system based on the Moon's position at birth. Total duration: 120 years.</p>
//       <div class="overflow-x-auto mt-6 bg-[#FFDBC25C] p-6 rounded">
//         <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">Maha Vimshottari Dasha</p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         ${
//           vimshottri_major_vdasha_data.length > 0
//             ? `
//         <table class="w-full text-[13px]">
//           <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//             <th class="p-2 border">Planet</th><th class="p-2 border">Start Date</th><th class="p-2 border">End Date</th>
//           </tr></thead>
//           <tbody>
//             ${vimshottri_major_vdasha_data
//               .map(
//                 (d) => `
//               <tr class="text-[#504E4F]">
//                 <td class="p-2 border">${d.planet || "-"}</td>
//                 <td class="p-2 border">${formatDate(d.start)}</td>
//                 <td class="p-2 border">${formatDate(d.end)}</td>
//               </tr>`,
//               )
//               .join("")}
//           </tbody>
//         </table>`
//             : ""
//         }
//       </div>`),

//     // ── 39. ANTAR DASHA ──
//     antar_dasha: sectionWrap(`
//       <div class="flex items-center justify-center">${sectionTitle("Antar Dasha")}</div>
//       <div class="overflow-x-auto mt-6 bg-[#FFDBC25C] p-6 rounded">
//         <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">Antar Vimshottari Dasha</p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         ${antarDashaHTML}
//       </div>`),

//     // ── 40. KP SYSTEM ──
//     kp_system: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("KP (Krishnamurti Paddhati)")}</div>
//       <p class="text-center text-[#504E4F] pt-6">KP Astrology is a highly precise system focusing on stellar, sub-lord, and cusp analysis to give accurate predictions.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 p-6 rounded-[11px]">
//         ${kpBasicHTML} ${kpPlanetsHTML} ${kpHousesHTML}
//         ${
//           kp_planets_data?.length > 0
//             ? `
//         <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//           <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">KP Planets</p>
//           <hr class="border border-[#F6CFD5] mb-4" />
//           <div class="overflow-x-auto">
//             <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//               <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                 <th class="p-2 border">Planet</th><th class="p-2 border">Sign</th><th class="p-2 border">Degree</th>
//                 <th class="p-2 border">Formatted Degree</th><th class="p-2 border">Norm Degree</th><th class="p-2 border">Formatted Norm Degree</th>
//                 <th class="p-2 border">Sign Lord</th><th class="p-2 border">Nakshatra</th><th class="p-2 border">Nakshatra Lord</th>
//                 <th class="p-2 border">Charan</th><th class="p-2 border">Sub Lord</th><th class="p-2 border">Sub Sub Lord</th>
//                 <th class="p-2 border">House</th><th class="p-2 border">Retrograde</th>
//               </tr></thead>
//               <tbody>
//                 ${kp_planets_data
//                   .map(
//                     (p) => `
//                   <tr class="text-[#504E4F]">
//                     <td class="p-2 border">${p.planet_name || "-"}</td><td class="p-2 border">${p.sign || "-"}</td>
//                     <td class="p-2 border">${p.degree?.toFixed(4) || "-"}</td><td class="p-2 border">${p.formatted_degree || "-"}</td>
//                     <td class="p-2 border">${p.norm_degree?.toFixed(4) || "-"}</td><td class="p-2 border">${p.formatted_norm_degree || "-"}</td>
//                     <td class="p-2 border">${p.sign_lord || "-"}</td><td class="p-2 border">${p.nakshatra || "-"}</td>
//                     <td class="p-2 border">${p.nakshatra_lord || "-"}</td><td class="p-2 border">${p.charan ?? "-"}</td>
//                     <td class="p-2 border">${p.sub_lord || "-"}</td><td class="p-2 border">${p.sub_sub_lord || "-"}</td>
//                     <td class="p-2 border">${p.house ?? "-"}</td><td class="p-2 border">${p.is_retro ? "Yes" : "No"}</td>
//                   </tr>`,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         </div>`
//             : ""
//         }
//       </div>`),

//     // ── 41. KP HOUSE CUSPS ──
//     kp_house_cusps: sectionWrap(`
//       ${
//         kp_house_cusps_data?.length > 0
//           ? `
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">KP House Cusps</p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         <div class="overflow-x-auto">
//           <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//             <thead><tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//               <th class="p-2 border">House</th><th class="p-2 border">Cusp Degree</th><th class="p-2 border">Formatted Degree</th>
//               <th class="p-2 border">Sign</th><th class="p-2 border">Sign Lord</th><th class="p-2 border">Nakshatra</th>
//               <th class="p-2 border">Nakshatra Lord</th><th class="p-2 border">Sub Lord</th><th class="p-2 border">Sub Sub Lord</th>
//             </tr></thead>
//             <tbody>
//               ${kp_house_cusps_data
//                 .map(
//                   (h) => `
//                 <tr class="text-[#504E4F]">
//                   <td class="p-2 border">${h.house_id ?? "-"}</td><td class="p-2 border">${h.cusp_full_degree?.toFixed(4) || "-"}</td>
//                   <td class="p-2 border">${h.formatted_degree || "-"}</td><td class="p-2 border">${h.sign || "-"}</td>
//                   <td class="p-2 border">${h.sign_lord || "-"}</td><td class="p-2 border">${h.nakshatra || "-"}</td>
//                   <td class="p-2 border">${h.nakshatra_lord || "-"}</td><td class="p-2 border">${h.sub_lord || "-"}</td>
//                   <td class="p-2 border">${h.sub_sub_lord || "-"}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`
//           : ""
//       }`),

//     yogini_dasha: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Yogini Dasha")}</div>
//       <p class="text-center text-[#504E4F] pt-6">Yogini Dasha divides a person's life into periods ruled by specific Yoginis, influencing events, experiences, and life direction.</p>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 p-6 rounded-[11px] shadow-md">
//         <p class="text-[#5E1520] text-center text-[22px] heading_font font-semibold mb-3">Sub-Yogini Dasha</p>
//         <hr class="border border-[#F6CFD5] mb-6" />
//         <div class="overflow-x-auto pb-4">
//           <div class="flex gap-6 px-1 min-w-max">
//             ${
//               sub_yogini_dasha?.length > 0
//                 ? sub_yogini_dasha
//                     .map((item) => {
//                       const major = item.major_dasha;
//                       const isCurrent =
//                         major.start_ms <= currentTimestamp &&
//                         major.end_ms >= currentTimestamp;
//                       return `
//                 <div class="bg-white border ${isCurrent ? "border-2 border-[#d9534f]/40 ring-1 ring-rose-300/50 shadow-lg" : "border-[#F6CFD5] shadow-sm"} rounded-xl min-w-[340px] flex flex-col overflow-hidden relative">
//                   ${isCurrent ? `<div class="absolute -top-2 -right-2 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-bl-lg rounded-tr-lg shadow">Current</div>` : ""}
//                   <div class="px-5 py-4">
//                     <h3 class="text-[#5E1520] heading_font font-semibold text-[17px]">${major.dasha_name} <span class="text-[14px] opacity-80">(Major)</span></h3>
//                     <p class="text-[#5E1520] text-[13px] mt-1">${major.start_date} – ${major.end_date} • <span class="font-medium">${major.duration} year${major.duration > 1 ? "s" : ""}</span></p>
//                   </div>
//                   <div class="p-4 text-[13.5px] text-gray-700 flex-1">
//                     <div class="space-y-2.5 divide-y divide-rose-100/70">
//                       ${item.sub_dasha
//                         .map((sub, subIndex) => {
//                           const isBold =
//                             subIndex === item.sub_dasha.length - 1 ||
//                             sub.dasha_name === major.dasha_name;
//                           return `<div class="flex justify-between py-1.5 ${isBold ? "font-medium text-[#5E1520]" : ""}"><span>${sub.dasha_name}</span><span>${sub.start_date} – ${sub.end_date}</span></div>`;
//                         })
//                         .join("")}
//                     </div>
//                   </div>
//                 </div>`;
//                     })
//                     .join("")
//                 : '<p class="text-center text-gray-600 py-8">No Yogini Dasha data available</p>'
//             }
//           </div>
//         </div>
//       </div>`),

//     major_yogini_dasha: sectionWrap(`
//       <div class="flex items-center justify-center mt-10">${sectionTitle("Major Yogini Dasha")}</div>
//       <p class="text-center text-[#504E4F] pt-6">The Major Yogini Dasha represents the planetary periods in cycles, showing start and end dates of each Yogini Dasha.</p>
//       <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#E65100] text-center text-[18px] font-medium">Major Yogini Dasha</p>
//         <hr class="border border-[#FFB74D] mt-2" />
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full table-auto border-collapse border border-[#FFB74D]">
//             <thead><tr class="bg-[#FFB74D]">
//               <th class="border border-[#FFE0B2] px-4 py-2 text-left">Dasha Name</th>
//               <th class="border border-[#FFE0B2] px-4 py-2 text-left">Start Date</th>
//               <th class="border border-[#FFE0B2] px-4 py-2 text-left">End Date</th>
//               <th class="border border-[#FFE0B2] px-4 py-2 text-left">Duration (Years)</th>
//             </tr></thead>
//             <tbody>
//               ${(Array.isArray(major_yogini_dasha) ? major_yogini_dasha : [])
//                 .map(
//                   (dasha) => `
//                 <tr class="hover:bg-[#FFE0B2]">
//                   <td class="border border-[#FFE0B2] px-4 py-2">${dasha.dasha_name}</td>
//                   <td class="border border-[#FFE0B2] px-4 py-2">${dasha.start_date}</td>
//                   <td class="border border-[#FFE0B2] px-4 py-2">${dasha.end_date}</td>
//                   <td class="border border-[#FFE0B2] px-4 py-2">${dasha.duration}</td>
//                 </tr>`,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//       </div>`),

//     disclaimer: `
//       <section class="h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative" style="background-image: url(&quot;${BG_IMAGE}&quot;)">
//         <div class="h-[85%]">
//           <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]">
//             <p class="text-center text-[#504E4F] pt-6">This Kundli report is based on Vedic astrology principles, aimed at guiding and motivating you. However, it should not be considered a substitute for professional advice in important matters such as health, legal issues, or work-related decisions.</p>
//           </div>
//           <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]">
//             <p class="text-center text-[#504E4F] pt-6">Your Kundli report is generated using Vedic astrology principles, which assign planets, houses, and dashas based on your birth time, date, and place.</p>
//             <p class="font-bold text-lg pt-4">Key Points in Your Report:</p>
//             <ul class="space-y-2 pt-2 pl-6 list-disc">
//               <li><span class="font-bold">Ascendant (Lagna):</span> Rising sign at birth; represents self and physical appearance.</li>
//               <li><span class="font-bold">Planetary Positions:</span> Where planets are placed in signs and houses.</li>
//               <li><span class="font-bold">Panchang:</span> Tithi, Nakshatra, Yoga, Karan at birth.</li>
//               <li><span class="font-bold">Dashas:</span> Planetary periods like Vimshottari for timing events.</li>
//               <li><span class="font-bold">Charts:</span> Lagna, Navamsa, etc., for deeper insights.</li>
//               <li><span class="font-bold">KP System:</span> Precise timing using sub-lords.</li>
//             </ul>
//             <div class="p-4 bg-[#e3af8a]/40 rounded-[10px] my-4">
//               <p><span class="font-semibold">Note:</span> This report uses standard Vedic calculations. Consult a professional astrologer for personalized advice.</p>
//             </div>
//           </div>
//         </div>
//         ${kalashFooter()}
//       </section>`,
//   };
// };

// const ALL_SECTIONS = [
//   "cover",
//   "welcome",
//   "basic_info",
//   "astro_details",
//   "chaughadiya",
//   "ayanamsha",
//   "chara_dasha",
//   "general_house_report",
//   "lalkitab_planets",
//   "hora_muhurta",
//   "ghat_chakra",
//   "planet_nature",
//   "general_rashi_1",
//   "general_rashi_2",
//   "panchang",
//   "charts_1",
//   "charts_2",
//   "hora_muhurta_dinman",
//   "jaimini_details",
//   "panchang_chart",
//   "panchang_hora_muhurta_dinman",
//   "panchang_lagna_table",
//   "planet_panchang",
//   "monthly_panchang",
//   "advanced_panchang",
//   "planets",
//   "lalkitab_remedies_1",
//   "lalkitab_remedies_2",
//   "lalkitab_horoscope",
//   "sarvashtak",
//   "bhav_madhya",
//   "moon_biorhythm",
//   "lalkitab_debts",
//   "lalkitab_houses_1",
//   "lalkitab_houses_2",
//   "lalkitab_houses_3",
//   "daily_nakshatra",
//   "vimshottari_dasha",
//   "antar_dasha",
//   "kp_system",
//   "kp_house_cusps",
//   "yogini_dasha",
//   "major_yogini_dasha",
//   "disclaimer",
// ];

// export const downloadKundliPDF = async ({
//   req_report,
//   res,
//   sections = null,
// }) => {
//   try {
//     const sectionMap = buildSections(req_report);
//     const sectionKeys = sections ?? ALL_SECTIONS;

//     const sectionsHTML = sectionKeys
//       .filter((key) => sectionMap[key] !== undefined)
//       .map((key) => sectionMap[key])
//       .join("\n");

//     const html = wrapHTML(sectionsHTML);
//     const pdfBuffer = await generatePDFBuffer(html);

//     if (!res.headersSent) {
//       res.set({
//         "Content-Type": "application/pdf",
//         "Content-Disposition": 'attachment; filename="Vedic_Kundli_Report.pdf"',
//       });
//       res.send(pdfBuffer);
//     }
//   } catch (err) {
//     console.error("Kundli PDF Error:", err);
//     if (!res.headersSent) {
//       res.status(500).json({
//         success: false,
//         message: "Failed to generate PDF",
//         error: err.message,
//       });
//     }
//   }
// };
