// import puppeteer from "puppeteer";
// const generatePDFBuffer = async (htmlContent) => {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
//   await page.setContent(htmlContent, { waitUntil: "networkidle0", timeout: 0 });
//   const pdfBuffer = await page.pdf({
//     format: "A4",
//     printBackground: true,
//     // margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
//   });
//   await browser.close();
//   return pdfBuffer;
// };

// export const downloadKundliPDF = async ({ req_report, res }) => {
//   try {
//     const report = req_report;

//     const data = report;
//     const birth_details_data = data?.birth_details || {};
//     const astro_details_data = data?.astro_details || {};
//     const basic_panchang_data = data?.basic_panchang || {};
//     const chaughadiya_muhurta = data?.chaughadiya_muhurta || {};
//     const hora_muhurta = data?.hora_muhurta || {};
//     const ayanamsha = data?.ayanamsha || {};
//     const hora_muhurta_dinman = data?.hora_muhurta_dinman || {};
//     const general_rashi_report = data?.general_rashi_report || {};
//     const general_house_report = data?.general_house_report || {};
//     const ghat_chakra = data?.ghat_chakra || {};
//     const current_chardasha = data?.current_chardasha || {};
//     const planet_panchang = data?.planet_panchang || {};
//     const current_yogini_dasha = data?.current_yogini_dasha || {};
//     const jaimini_details = data?.jaimini_details || {};
//     const planet_nature = data?.planet_nature || {};
//     const monthly_panchang = data?.monthly_panchang || {};
//     const lalkitab_remedies = data?.lalkitab_remedies || {};
//     const bhav_madhya = data?.bhav_madhya || {};
//     const panchang_chart = data?.panchang_chart || {};
//     const panchang_hora_muhurta_dinman =
//       data?.panchang_hora_muhurta_dinman || {};
//     const lalkitab_planets = data?.lalkitab_planets || {};
//     const daily_nakshatra_prediction = data?.daily_nakshatra_prediction || {};
//     const major_yogini_dasha = data?.major_yogini_dasha || {};

//     const general_nakshatra_report = data?.general_nakshatra_report || {};
//     const sarvashtak = data?.sarvashtak || {};
//     const lalkitab_debts = data?.lalkitab_debts || {};
//     const lalkitab_houses = data?.lalkitab_houses || {};
//     const moon_biorhythm = data?.moon_biorhythm || {};
//     const kp_planets = data?.kp_planets || {};
//     const general_ascendant_report = data?.general_ascendant_report || {};
//     const lalkitab_horoscope = data?.lalkitab_horoscope || {};
//     const sub_yogini_dasha = data?.sub_yogini_dasha || {};
//     const advanced_panchang = data?.advanced_panchang || {};
//     const vishamansha_chart = data?.vishamansha_chart || {};
//     const trishamansha_chart = data?.trishamansha_chart || {};
//     const akshvedansha_chart = data?.akshvedansha_chart || {};
//     const panchmansha_chart = data?.panchmansha_chart || {};
//     const chathurthamasha_chart = data?.chathurthamasha_chart || {};
//     const chaturvimshamsha_chart = data?.chaturvimshamsha_chart || {};
//     const sun_chart = data?.sun_chart || {};
//     const panchang_lagna_table = data?.panchang_lagna_table || {};
//     const ashtamansha_chart = data?.ashtamansha_chart || {};
//     const moon_chart = data?.moon_chart || {};
//     const bhamsha_chart = data?.bhamsha_chart || {};
//     const hora_chart = data?.hora_chart || {};
//     const dwadashamsha_chart = data?.dwadashamsha_chart || {};
//     const shodashamsha_chart = data?.shodashamsha_chart || {};

//     const birth_chart_data = data?.birth_chart || {};
//     const navamansha_chart_data = data?.navamansha_chart || {};
//     const planets_data = data?.planets || [];
//     const vimshottri_major_vdasha_data = data?.vimshottri_major_vdasha || [];
//     const vimshottri_antar_vdasha_data = data?.vimshottri_antar_vdasha || {};
//     const kp_planets_data = data?.kp_planets || [];
//     const kp_house_cusps_data = data?.kp_house_cusps || [];
//     const chalit_chart_data = data?.chalit_chart || {};
//     const dashamansha_chart_data = data?.dashamansha_chart || {};
//     const saptamansha_chart_data = data?.saptamansha_chart || {};

//     const dayHoras = hora_muhurta?.hora?.day || [];
//     const nightHoras = hora_muhurta?.hora?.night || [];

//     const dayHorasmuhurta_dinman = hora_muhurta_dinman?.hora?.day || [];
//     const nightHorasmuhurta_dinman = hora_muhurta_dinman?.hora?.night || [];

//     const karakas = jaimini_details?.jaimini_karaka || {};

//     const dayHorasPanchnag = panchang_hora_muhurta_dinman?.hora?.day || [];
//     const nightHorasPanchnag = panchang_hora_muhurta_dinman?.hora?.night || [];

//     const tithi = advanced_panchang?.tithi?.details || {};
//     const nakshatra = advanced_panchang?.nakshatra?.details || {};
//     const yog = advanced_panchang?.yog?.details || {};
//     const karan = advanced_panchang?.karan?.details || {};
//     const hinduMaah = advanced_panchang?.hindu_maah || {};
//     const madhyaList = bhav_madhya?.bhav_madhya || [];
//     const sandhiList = bhav_madhya?.bhav_sandhi || [];

//     const backgroundImage =
//       "https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/bg_pages.jpg";
//     const kalashImage =
//       "https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/kalash.png";

//     const panchangList = monthly_panchang?.panchang || [];
//     const asc_report = general_ascendant_report?.asc_report || {};
//     const ashtakPoints = sarvashtak?.ashtak_points || {};
//     const prediction = daily_nakshatra_prediction?.prediction || {};

//     const currentTimestamp = Date.now();

//     const formatTime = (decimal) => {
//       if (!decimal) return "-";

//       const hours = Math.floor(decimal);
//       const minutes = Math.round((decimal - hours) * 60);

//       return `${hours}:${minutes.toString().padStart(2, "0")}`;
//     };

//     // Function to format date strings safely
//     const formatDate = (dateStr) => {
//       if (!dateStr) return "-";
//       try {
//         const [datePart, timePart] = dateStr.split("  ");
//         const [d, m, y] = datePart
//           .split("-")
//           .map((part) => part.padStart(2, "0"));
//         return `${d}-${m}-${y} ${timePart || ""}`;
//       } catch {
//         return dateStr;
//       }
//     };

//     // Dynamically build Antar Dasha HTML (since we can't use DOM in Node.js)
//     let antarDashaHTML = "";
//     if (
//       Object.keys(vimshottri_antar_vdasha_data).length > 0 &&
//       !vimshottri_antar_vdasha_data.error
//     ) {
//       for (const [mahaPlanet, antarList] of Object.entries(
//         vimshottri_antar_vdasha_data,
//       )) {
//         if (!Array.isArray(antarList) || antarList.length === 0) continue;
//         const mahaStart = formatDate(antarList[0]?.start || "-");
//         const mahaEnd = formatDate(antarList[antarList.length - 1]?.end || "-");

//         antarDashaHTML += `
//           <div class="mb-10">
//             <p class="text-[#5E1520] font-bold text-lg mb-3">
//               ${mahaPlanet} Mahadasha (${mahaStart} – ${mahaEnd})
//             </p>
//             <table class="w-full text-[13px] border-collapse bg-white rounded">
//               <thead>
//                 <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                   <th class="p-2 border border-[#F6CFD5]">Antardasha in ${mahaPlanet}</th>
//                   <th class="p-2 border border-[#F6CFD5]">Start Date</th>
//                   <th class="p-2 border border-[#F6CFD5]">End Date</th>
//                 </tr>
//               </thead>
//               <tbody class="text-[#504E4F] ">
//                 ${antarList
//                   .map(
//                     (antar) => `
//                   <tr>
//                     <td class="p-2 border">${antar.planet || "-"}</td>
//                     <td class="p-2 border">${formatDate(antar.start)}</td>
//                     <td class="p-2 border">${formatDate(antar.end)}</td>
//                   </tr>
//                 `,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         `;
//       }
//     }

//     // KP Basic Details (Dynamic if data exists)

//     const kp = data?.kp_details || {}; // ← Yeh parent hai

//     const basic = kp?.basic_details || {};
//     const planets = kp?.planets || [];
//     const houses = kp?.houses || [];

//     // ============ 1. KP Basic Details ============
//     let kpBasicHTML = "";
//     if (Object.keys(basic).length > 0) {
//       kpBasicHTML = `
//     <div class="mb-10">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">
//         KP Basic Details
//       </h3>
//       <table style="width:100%; border-collapse:collapse; font-size:14px; background:white;">
//         <tr><td style="padding:10px; border:1px solid #ddd; width:45%;"><strong>Ayanamsa</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${Number(
//               basic.ayanamsha || 0,
//             ).toFixed(6)}</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Sunrise</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${
//               basic.sunrise || "-"
//             }</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Sunset</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${
//               basic.sunset || "-"
//             }</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Ascendant (Lagna)</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${
//               basic.ascendant || "-"
//             }</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Moon Rashi</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${
//               basic.rashi || "-"
//             }</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Birth Nakshatra</strong></td>
//             <td style="padding:10px; border:1px solid #ddd;">${
//               basic.nakshatra || "-"
//             }</td></tr>
//         <tr><td style="padding:10px; border:1px solid #ddd;"><strong>Vimshottari Dasha Balance</strong></td>
//             <td style="padding:10px; border:1px solid #ddd; font-weight:600;">${
//               basic.dasha_balance || "-"
//             }</td></tr>
//       </table>
//     </div>
//   `;
//     }

//     // ============ 2. KP Planets Table ============
//     let kpPlanetsHTML = "";
//     if (planets.length > 0) {
//       kpPlanetsHTML = `
//     <div class="mb-10">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">
//         KP Planet Positions & Sub-Lords
//       </h3>
//       <div style="overflow-x:auto;">
//         <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:700px;">
//           <thead>
//             <tr style="background:#F6CFD5; color:#5E1520;">
//               <th style="padding:10px; border:1px solid #ccc;">Planet</th>
//               <th style="padding:10px; border:1px solid #ccc;">Sign</th>
//               <th style="padding:10px; border:1px solid #ccc;">House</th>
//               <th style="padding:10px; border:1px solid #ccc;">Nakshatra (Charan)</th>
//               <th style="padding:10px; border:1px solid #ccc; background:#ffe6e6;">Sub Lord</th>
//               <th style="padding:10px; border:1px solid #ccc;">Sub-Sub</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${planets
//               .map(
//                 (p) => `
//               <tr>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:600;">${p.planet_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.sign_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.house}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.nakshatra_name} (${p.nakshatra_charan})</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#d35400;">${p.sub_lord}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${p.sub_sub_lord}</td>
//               </tr>
//             `,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   `;
//     }

//     // ============ 3. KP House Cusps Table ============
//     let kpHousesHTML = "";
//     if (houses.length > 0) {
//       kpHousesHTML = `
//     <div class="mb-8">
//       <h3 style="font-size:20px; color:#5E1520; margin-bottom:12px; font-weight:bold;">
//         KP House Cusps & Sub-Lords (Placidus)
//       </h3>
//       <div style="overflow-x:auto;">
//         <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:700px;">
//           <thead>
//             <tr style="background:#F6CFD5; color:#5E1520;">
//               <th style="padding:10px; border:1px solid #ccc;">House</th>
//               <th style="padding:10px; border:1px solid #ccc;">Sign</th>
//               <th style="padding:10px; border:1px solid #ccc;">Nakshatra (Charan)</th>
//               <th style="padding:10px; border:1px solid #ccc; background:#ffe6e6;">Cusp Sub Lord</th>
//               <th style="padding:10px; border:1px solid #ccc;">Sub-Sub Lord</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${houses
//               .map(
//                 (h) => `
//               <tr>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; background:#f9f9f9;">${h.house_id}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.sign_name}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.nakshatra_name} (${h.nakshatra_charan})</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#d35400;">${h.sub_lord}</td>
//                 <td style="padding:9px; border:1px solid #ddd; text-align:center;">${h.sub_sub_lord}</td>
//               </tr>
//             `,
//               )
//               .join("")}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   `;
//     }

//     const html = `
// <!doctype html>
// <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <title>Kundli Report</title>
//     <script src="https://cdn.tailwindcss.com"></script>
//     <style>
//       body {
//         font-family: "Segoe UI", sans-serif;
//       }
//       .heading_font {
//         font-family: "Georgia", serif;
//         font-weight: bold;
//       }
//       .section {
//         min-height: 100vh;
//         background: url("${backgroundImage}") center/contain no-repeat;
//         position: relative;
//       }
//       .kalash {
//         position: absolute;
//         bottom: 30px;
//         width: 90px;
//       }
//       .kalash-left {
//         left: 40px;
//       }
//       .kalash-right {
//         right: 40px;
//       }
//       table {
//         width: 100%;
//         border-collapse: collapse;
//         margin: 20px 0;
//         font-size: 14px;
//       }
//       th,
//       td {
//         border: 1px solid #9d2235;
//         padding: 10px;
//         text-align: center;
//       }
//       th {
//         background: #9d2235;
//         color: white;
//       }
//     </style>
//   </head>
//   <body class=" mx-auto">
//     <section
//       class="h-[100vh] py-10"
//       style="background: linear-gradient(180deg, #370c12 0%, #9d2235 100%)"
//     >
//       <div class="">
//         <span
//           class="bg-[#FFDBC22E] text-white text-[25px] font-medium px-10 py-4"
//           >Logo</span
//         >
//       </div>
//       <div class="h-full flex items-center justify-center">
//         <div class="">
//           <img
//             src="https://assetforwebsite.s3.ap-southeast-2.amazonaws.com/landingPage.png"
//             class="w-[60%] mx-auto"
//             alt=""
//           />
//           <p class="heading_font text-center pt-4 text-[#FF7010] text-[32px]">
//             Vedic Astrology Report
//           </p>
//           <p class="text-center text-[#fff] text-[18px] font-medium">
//             Generated on: ${new Date().toLocaleString("en-GB", {
//               day: "2-digit",
//               month: "2-digit",
//               year: "numeric",
//               hour: "2-digit",
//               minute: "2-digit",
//               hour12: true,
//             })}
//           </p>
//         </div>
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center flex items-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="">
//         <p class="heading_font text-[18px]">
//           Hey,<br />
//           Welcome to your Kundli Report! <br /><br />
//           Your birth chart holds a unique story about who you are and the
//           journey you're meant to follow. For thousands of years, Vedic
//           Astrology has helped people understand their strengths, challenges,
//           and life direction by studying the positions of planets at the exact
//           moment of birth. <br /><br />
//           It may sound mystical, but it's deeply rooted in astronomy. The
//           movement of celestial bodies—Sun, Moon, and planets—creates energetic
//           patterns that influence our nature, decisions, relationships, career,
//           and overall path in life. <br /><br />
//           In this report, we've used your birth details to create your Kundli,
//           which reveals your Ascendant, Moon Sign, planetary placements, yogas,
//           and the influence of different dashas. Each of these elements offers
//           meaningful insights into your personality, emotions, opportunities,
//           and future possibilities. <br /><br />
//           People use Kundli for many important aspects of life—understanding
//           themselves better, planning relationships, exploring career
//           directions, choosing auspicious moments, or gaining clarity about life
//           events. <br /><br />
//           We hope this detailed Kundli Report gives you deeper self-awareness
//           and helps you navigate your journey with confidence and clarity.
//           <br /><br />
//           Thank you for exploring Vedic Astrology with us!
//         </p>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Basic Information</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <p class="text-center text-[#504E4F] pt-6">
//           The accuracy and quality of your predictions depend almost entirely on
//           the correctness of Birth Details. These details act as the input for
//           generating the Kundli, divisional charts, dashas, yogas, remedies, and
//           predictions.
//         </p>
//         <div class="flex items-center justify-center mt-10">
//           <span
//             class="text-[#FF7010] border border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//             >Birth Details Information</span
//           >
//         </div>
//         <div
//           class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]"
//         >
//           <p class="flex items-center justify-between pt-4 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Birth Year :</span>
//             <span>${birth_details_data.year || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Birth Month :</span>
//             <span>${birth_details_data.month || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Birth Date :</span>
//             <span>${birth_details_data.day || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Birth Time :</span>
//             <span
//               >${birth_details_data.hour || "-"}:${
//                 birth_details_data.minute?.toString().padStart(2, "0") || "-"
//               }</span
//             >
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Latitude :</span>
//             <span>${birth_details_data.latitude || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Longitude :</span>
//             <span>${birth_details_data.longitude || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Timezone :</span>
//             <span>${birth_details_data.timezone || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Ayanamsha :</span>
//             <span>${birth_details_data.ayanamsha || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sunrise :</span>
//             <span>${birth_details_data.sunrise || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sunset :</span>
//             <span>${birth_details_data.sunset || "-"}</span>
//           </p>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="h-[85%]">
//         <div class="flex items-center justify-center mt-10">
//           <span
//             class="text-[#FF7010] border border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//             >Some More Information</span
//           >
//         </div>
//         <div
//           class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]"
//         >
//           <p class="text-[#5E1520] text-center text-[18px] font-medium">
//             Astro Details
//           </p>
//           <hr class="border border-[#F6CFD5] mt-2" />
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Ascendant :</span>
//             <span>${astro_details_data.ascendant || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Ascendant Lord :</span>
//             <span>${astro_details_data.ascendant_lord || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Varna :</span>
//             <span>${astro_details_data.Varna || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Vashya :</span>
//             <span>${astro_details_data.Vashya || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Yoni :</span>
//             <span>${astro_details_data.Yoni || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Gan :</span>
//             <span>${astro_details_data.Gan || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Nadi :</span>
//             <span>${astro_details_data.Nadi || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sign :</span>
//             <span>${astro_details_data.sign || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sign Lord :</span>
//             <span>${astro_details_data.SignLord || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Nakshatra :</span>
//             <span>${astro_details_data.Naksahtra || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Nakshatra Lord :</span>
//             <span>${astro_details_data.NaksahtraLord || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Charan :</span>
//             <span>${astro_details_data.Charan || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Yog :</span>
//             <span>${astro_details_data.Yog || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Karan :</span>
//             <span>${astro_details_data.Karan || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Tithi :</span>
//             <span>${astro_details_data.Tithi || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Yunja :</span>
//             <span>${astro_details_data.yunja || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Tatva :</span>
//             <span>${astro_details_data.tatva || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Name Alphabet :</span>
//             <span>${astro_details_data.name_alphabet || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Paya :</span>
//             <span>${astro_details_data.paya || "-"}</span>
//           </p>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Chaughadiya Muhurta</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Chaughadiya Muhurta is a traditional time-selection method used in
//             Hindu Astrology to determine whether a particular period of the day
//             or night is favorable or unfavorable for starting important
//             activities. The word "Chaughadiya" comes from two Sanskrit-derived
//             words: "Chau" meaning four and "Ghadi" meaning a traditional unit of
//             time. Historically, four ghadis together formed one Chaughadiya,
//             which is approximately 96 minutes. Based on this system, both the
//             daytime (from sunrise to sunset) and nighttime (from sunset to the
//             next sunrise) are divided into eight equal segments, creating a
//             total of sixteen Chaughadiya periods within a 24-hour cycle.
//           </p>
//         </div>
//         <div class="">
//           <div class="overflow-x-auto">
//             <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//               <thead>
//                 <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                   <th class="p-2 border">Period</th>
//                   <th class="p-2 border">Time</th>
//                   <th class="p-2 border">Muhurta</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 <!-- Day Chaughadiya -->
//                 <tr class="bg-[#f9e4e7] font-semibold">
//                   <td colspan="3" class="p-2 border text-center">
//                     Day Chaughadiya
//                   </td>
//                 </tr>

//                 ${chaughadiya_muhurta.chaughadiya.day
//                   .map(
//                     (d) => `
//                 <tr class="text-[#504E4F] ">
//                   <td class="p-2 border">Day</td>
//                   <td class="p-2 border">${d.time}</td>
//                   <td class="p-2 border">${d.muhurta}</td>
//                 </tr>
//                 `,
//                   )
//                   .join("")}

//                 <!-- Night Chaughadiya -->
//                 <tr class="bg-[#f9e4e7] font-semibold">
//                   <td colspan="3" class="p-2 border text-center">
//                     Night Chaughadiya
//                   </td>
//                 </tr>

//                 ${data.chaughadiya_muhurta.chaughadiya.night
//                   .map(
//                     (n) => `
//                 <tr class="text-[#504E4F] ">
//                   <td class="p-2 border">Night</td>
//                   <td class="p-2 border">${n.time}</td>
//                   <td class="p-2 border">${n.muhurta}</td>
//                 </tr>
//                 `,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Ayanamsha</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Ayanamsha is an important concept in Hindu Astrology (also called
//             Vedic Astrology) that refers to the angular difference between the
//             tropical zodiac and the sidereal zodiac. It is used to correct
//             planetary positions when calculating horoscopes so that they align
//             with the actual positions of the fixed stars in the sky.
//             <br /><br />

//             The term "Ayanamsha" comes from two Sanskrit words: "Ayana", meaning
//             movement or path, and "Aṁśa", meaning portion or degree. Together,
//             the term describes the degree of shift caused by the gradual
//             movement of Earth's rotational axis, a phenomenon scientifically
//             known as the Axial Precession. Because of this slow movement, the
//             position of the equinox shifts slightly every year, creating a
//             difference between the tropical zodiac (used in Western astrology)
//             and the sidereal zodiac (used in Vedic astrology).
//           </p>
//         </div>
//         <div class="">
//           <div class="overflow-x-auto">
//             <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//               <thead>
//                 <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                   <th class="p-2 border">Ayanamsha Type</th>
//                   <th class="p-2 border">Degree</th>
//                   <th class="p-2 border">Formatted</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 ${ayanamsha
//                   .map(
//                     (a) => `
//                 <tr class="text-[#504E4F] ">
//                   <td class="p-2 border">${a.type || "-"}</td>
//                   <td class="p-2 border">
//                     ${a.degree ? a.degree.toFixed(6) : "-"}
//                   </td>
//                   <td class="p-2 border">${a.formatted || "-"}</td>
//                 </tr>
//                 `,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Chara Dasha</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Chara Dasha is a predictive timing system used in Jaimini Astrology,
//             a branch of Vedic Astrology. It is used to analyze how different
//             zodiac signs influence a person's life during specific periods of
//             time. The term "Chara" means "movable" or "dynamic," and "Dasha"
//             means "planetary or sign-based period." Unlike many other dasha
//             systems that are based on planets, Chara Dasha is sign-based,
//             meaning each zodiac sign governs a certain time period in a person's
//             life.
//             <br /><br />

//             In the Chara Dasha system, the twelve zodiac signs take turns ruling
//             different periods of life. Each sign represents particular themes,
//             opportunities, and challenges depending on its placement in the
//             birth chart. Astrologers analyze these periods to understand when
//             significant events such as career changes, relationships, travel, or
//             personal growth may occur. The duration of each sign's dasha varies
//             and is calculated according to specific rules in Jaimini astrology.
//           </p>
//         </div>
//         <div class="">
//           <div class="flex flex-wrap gap-4 mt-6">
//   <!-- Major Dasha Card -->
//   <div class="bg-[#FFF3E0] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//     <p class="font-semibold text-[#FB8C00] text-lg">Major Dasha</p>
//     <div class="mt-2  text-[#504E4F]">
//       <p><span class="font-medium">Sign:</span> ${current_chardasha.major_dasha.sign_name}</p>
//       <p><span class="font-medium">Duration:</span> ${current_chardasha.major_dasha.duration}</p>
//       <p><span class="font-medium">Start Date:</span> ${current_chardasha.major_dasha.start_date}</p>
//       <p><span class="font-medium">End Date:</span> ${current_chardasha.major_dasha.end_date}</p>
//     </div>
//   </div>

//   <!-- Sub Dasha Card -->
//   <div class="bg-[#E1F5FE] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//     <p class="font-semibold text-[#0277BD] text-lg">Sub Dasha</p>
//     <div class="mt-2  text-[#504E4F]">
//       <p><span class="font-medium">Sign:</span> ${current_chardasha.sub_dasha.sign_name}</p>
//       <p><span class="font-medium">Duration:</span> ${current_chardasha.sub_dasha.duration || "-"}</p>
//       <p><span class="font-medium">Start Date:</span> ${current_chardasha.sub_dasha.start_date}</p>
//       <p><span class="font-medium">End Date:</span> ${current_chardasha.sub_dasha.end_date}</p>
//     </div>
//   </div>

//   <!-- Sub-Sub Dasha Card -->
//   <div class="bg-[#E8F5E9] p-4 rounded-lg shadow-md w-full sm:w-[48%] lg:w-[30%]">
//     <p class="font-semibold text-[#2E7D32] text-lg">Sub-Sub Dasha</p>
//     <div class="mt-2  text-[#504E4F]">
//       <p><span class="font-medium">Sign:</span> ${current_chardasha.sub_sub_dasha.sign_name}</p>
//       <p><span class="font-medium">Duration:</span> ${current_chardasha.sub_sub_dasha.duration || "-"}</p>
//       <p><span class="font-medium">Start Date:</span> ${current_chardasha.sub_sub_dasha.start_date}</p>
//       <p><span class="font-medium">End Date:</span> ${current_chardasha.sub_sub_dasha.end_date}</p>
//     </div>
//   </div>
// </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >General House Report</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             A General House Report in Vedic Astrology is a section of a
//             horoscope or Kundli analysis that explains the significance and
//             influence of the twelve astrological houses in a person's birth
//             chart. In astrology, a birth chart is divided into twelve houses,
//             and each house represents a specific area of life such as
//             personality, wealth, relationships, career, health, and
//             spirituality. The General House Report provides a broad
//             interpretation of how these houses affect the native's life based on
//             planetary placements and zodiac signs present in those houses.
//             <br /><br />

//             Each house in the chart has a unique meaning and governs certain
//             life aspects. </p>
//         </div>
//         <div class="">
//         <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     General House Reports
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />


//   ${Object.values(general_house_report)
//     .map(
//       (item, index) => `
//     <div key={index} class="pt-4">
//       <p class="justify-between text-[14px]">
//         <span class="text-[#5E1520] font-medium">${item?.planet}</span>
//         <br />

//         <span>${item?.house_report}</span>
//       </p>

//       <br />
//       <br />
//     </div>
//  `,
//     )
//     .join("")}
// </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           > Lal Kitab Planet</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Lal Kitab Planets refers to the planetary positions and their
//             influences according to the principles of Lal Kitab, an ancient
//             branch of Vedic astrology that blends traditional astrology with
//             remedial measures. Unlike standard astrology, Lal Kitab emphasizes
//             practical remedies, often simple actions or rituals, to counteract
//             the negative effects of planets and enhance positive outcomes.
//             <br /><br />

//             In the Lal Kitab system, each planet has unique characteristics,
//             qualities, and areas of influence. The position of a planet in a
//             particular sign, house, or relation to other planets can
//             significantly impact various aspects of a person's life, including
//             career, health, relationships, and wealth. Lal Kitab also emphasizes
//             planetary "strength" or "weakness" and prescribes remedies to reduce
//             malefic influences and strengthen benefic planets.
//           </p>
//         </div>
// <div>
//   <div class="overflow-x-auto w-[80%] mx-auto mt-10 bg-[#FFDBC25C] p-6 rounded-[11px]">
//     <p class="text-[#5E1520] text-center text-[18px] font-medium mb-2">
//       Lal Kitab Planets
//     </p>

//     <hr class="border border-[#F6CFD5] mb-4" />

//     <table class="w-full text-[13px] border border-[#e5b8b3] rounded">
//       <thead>
//         <tr class="bg-[#F6CFD5] text-[#5E1520] font-medium">
//           <th class="p-2 border">Planet</th>
//           <th class="p-2 border">Rashi</th>
//           <th class="p-2 border">Soya</th>
//           <th class="p-2 border">Position</th>
//           <th class="p-2 border">Nature</th>
//         </tr>
//       </thead>

//    <tbody>
//   ${lalkitab_planets
//     .map(
//       (item, index) => `
//         <tr class="text-[#504E4F]">
//           <td class="p-2 border">${item?.planet}</td>
//           <td class="p-2 border">${item?.rashi}</td>
//           <td class="p-2 border">${item?.soya ? "Yes" : "No"}</td>
//           <td class="p-2 border">${item?.position}</td>
//           <td class="p-2 border">${item?.nature}</td>
//         </tr>
//       `,
//     )
//     .join("")}
// </tbody>
//     </table>
//   </div>
// </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Hora Muhurta</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Hora Muhurta is a system in Vedic astrology used to select favorable
//             hours of the day for performing important activities such as
//             starting a business, traveling, making investments, or conducting
//             rituals. The word "Hora" comes from the Sanskrit term for "hour,"
//             while "Muhurta" refers to an auspicious time period. Together, Hora
//             Muhurta identifies the most suitable hours of the day based on
//             planetary influences.
//           </p>
//         </div>
//        <div>
//   <div class="overflow-x-auto w-[90%] mx-auto mt-10 p-4 bg-[#FFDBC25C] rounded-lg">
//     <p class="text-[#5E1520] text-center text-[18px] font-medium">
//       Hora Muhurta
//     </p>

//     <hr class="border border-[#F6CFD5] my-2" />

//     <p class="text-[#5E1520] font-medium mt-2 mb-1">Day Horas</p>

//     <table class="w-full text-[12px] border border-[#e5b8b3] rounded mb-4">
//       <thead>
//         <tr class="bg-[#F6CFD5] text-[#5E1520]">
//           <th class="p-2 border">Time</th>
//           <th class="p-2 border">Hora (Planet)</th>
//         </tr>
//       </thead>

//      <tbody>
//   ${dayHoras
//     .map(
//       (item, index) => `
//         <tr>
//           <td class="p-2 border">${item?.time?.replace(":", " - ")}</td>
//           <td class="p-2 border">${item?.hora}</td>
//         </tr>
//       `,
//     )
//     .join("")}
// </tbody>
//     </table>


//     <p class="text-[#5E1520] font-medium mt-2 mb-1">Night Horas</p>

//     <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//       <thead>
//         <tr class="bg-[#F6CFD5] text-[#5E1520]">
//           <th class="p-2 border">Time</th>
//           <th class="p-2 border">Hora (Planet)</th>
//         </tr>
//       </thead>

//     <tbody>
//   ${nightHoras
//     .map(
//       (item, index) => `
//         <tr>
//           <td class="p-2 border">${item?.time?.replace(":", " - ")}</td>
//           <td class="p-2 border">${item?.hora}</td>
//         </tr>
//       `,
//     )
//     .join("")}
// </tbody>
//     </table>
//   </div>
// </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >The Ghat Chakra</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             The Ghat Chakra is an important concept in Vedic astrology, used to
//             divide a day into precise time segments for selecting auspicious
//             periods for various activities, especially rituals, ceremonies, or
//             important undertakings. It is closely related to Hora, Muhurta, and
//             Chaughadiya, but instead of just dividing the day by planetary hours
//             or four-part periods, the Ghat Chakra divides the day and night into
//             60 ghatikas
//           </p>
//         </div>
//       <div>
//   <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//     <p class="text-[#5E1520] text-center text-[18px] font-medium">
//       Ghat Chakra Details
//     </p>

//     <hr class="border border-[#F6CFD5] mt-2" />

// ${Object.entries(ghat_chakra)
//   .map(
//     ([key, value], index) => `
//       <p class="flex items-center justify-between pt-2 text-[14px]">
//         <span class="text-[#5E1520] font-medium capitalize">
//           ${key} :
//         </span>
//         <span>${value}</span>
//       </p>
//    `,
//   )
//   .join("")}
//   </div>
// </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Planet Nature</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             In astrology, Planet Nature refers to the inherent qualities of each
//             planet in a horoscope (kundli) that influence human behavior,
//             events, and outcomes in life. Each planet is assigned a nature
//             (Benefic or Malefic), which determines how its energy affects the
//             native depending on its placement, conjunctions, or aspects
//           </p>
//         </div>
// <div>
//   <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//     <p class="text-[#5E1520] text-center text-[18px] font-medium">
//       Planet Nature in Astrology
//     </p>

//     <hr class="border border-[#F6CFD5] mt-2" />
// ${Object.entries(planet_nature || {})
//   .map(
//     ([key, value]) => `
//       <p class="flex items-center justify-between pt-2 text-[14px]">
//         <span class="text-[#5E1520] font-medium">
//           ${key.charAt(0) + key.slice(1).toLowerCase()} Planets :
//         </span>

//         <span>${(value || []).join(", ")}</span>
//       </p>
//     `,
//   )
//   .join("")}
//   </div>
// </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >The General Rashi Report</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             In astrology, the General Rashi Report refers to a detailed overview
//             of each zodiac sign (Rashi) in a horoscope, highlighting the general
//             personality traits, tendencies, strengths, weaknesses, and
//             influences of planets on that sign. It is a high-level assessment
//             used to understand how a person's zodiac sign shapes their behavior,
//             emotions, career potential, relationships, and overall life
//             patterns.
//           </p>
//         </div>
// <div class="w-[90%] mx-auto mt-10">
//   <p class="text-[#5E1520] text-center text-[20px] font-semibold mb-4">
//     General Rashi Report
//   </p>

// ${Object.values(general_rashi_report)
//   .slice(0, 3)
//   .map(
//     (item) => `
//       <div class="bg-[#FFDBC25C] p-6 rounded-[11px] mb-6">
//         <p class="text-[#5E1520] text-[16px] font-semibold">${item.planet}</p>

//         <hr class="border border-[#F6CFD5] my-2" />

//         <p class="text-[#504E4F] text-[14px] leading-relaxed">
//           ${item.rashi_report}
//         </p>
//       </div>
//       `,
//   )
//   .join("")}
// </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>
//         <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >

// <div class="w-[90%] mx-auto mt-10">
//   <p class="text-[#5E1520] text-center text-[20px] font-semibold mb-4">
//     General Rashi Report
//   </p>

// ${Object.values(general_rashi_report)
//   .slice(3)
//   .map(
//     (item) => `
//       <div class="bg-[#FFDBC25C] p-6 rounded-[11px] mb-6">
//         <p class="text-[#5E1520] text-[16px] font-semibold">${item.planet}</p>

//         <hr class="border border-[#F6CFD5] my-2" />

//         <p class="text-[#504E4F] text-[14px] leading-relaxed">
//           ${item.rashi_report}
//         </p>
//       </div>
//       `,
//   )
//   .join("")}
// </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Panchang</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Panchang describes the five key elements that define the energy and
//             nature of any given day — Tithi, Nakshatra, Yoga, Karana, and Vaar.
//             Each of these influences a person's mindset, behavior,
//             opportunities, and emotional tendencies.

//           </p>
//         </div>
//         <div
//           class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]"
//         >
//           <p class="text-[#5E1520] text-center text-[18px] font-medium">
//             Panchang Details
//           </p>
//           <hr class="border border-[#F6CFD5] mt-2" />
//           <p class="flex items-center justify-between pt-4 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Day :</span>
//             <span>${basic_panchang_data.day || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Tithi :</span>
//             <span>${basic_panchang_data.tithi || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Nakshatra :</span>
//             <span>${basic_panchang_data.nakshatra || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Yog :</span>
//             <span>${basic_panchang_data.yog || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Karan :</span>
//             <span>${basic_panchang_data.karan || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sunrise :</span>
//             <span>${basic_panchang_data.sunrise || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Sunset :</span>
//             <span>${basic_panchang_data.sunset || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-2 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Vedic Sunrise :</span>
//             <span>${basic_panchang_data.vedic_sunrise || "-"}</span>
//           </p>
//           <p class="flex items-center justify-between pt-4 text-[14px]">
//             <span class="text-[#5E1520] font-medium">Vedic Sunset :</span>
//             <span>${basic_panchang_data.vedic_sunset || "-"}</span>
//           </p>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] text-center border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Janma Kundli / Navamansha Chart / Other Charts</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Birth Chart, also known as Janma Kundli, is the primary and most
//           important chart in Vedic Astrology. It represents the exact position
//           of all planets at the moment of birth. This chart becomes the
//           foundation of the entire horoscope analysis. and The Navamansha Chart,
//           also known as the D9 chart, is one of the most powerful and respected
//           divisional charts in Vedic Astrology. It is a refined version of the
//           birth chart and shows the inner strength and true potential of
//           planets.
//         </p>
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <div
//             class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]"
//           >
//             <p class="text-center text-[#5E1520] text-[18px] font-medium mb-4">
//               Astrological Charts
//             </p>
//             <hr class="border border-[#F6CFD5] mb-6" />
//             <div class="flex items-center justify-around gap-4 flex-wrap">
//               ${
//                 birth_chart_data.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Birth Chart
//                 </p>
//                 <img
//                   src="${birth_chart_data.chart_url}"
//                   alt="Birth Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 moon_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Moon Chart
//                 </p>
//                 <img
//                   src="${moon_chart.chart_url}"
//                   alt="Moon Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 vishamansha_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Vishamansha Chart
//                 </p>
//                 <img
//                   src="${vishamansha_chart.chart_url}"
//                   alt="vishamansha Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 panchmansha_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Vishamansha Chart
//                 </p>
//                 <img
//                   src="${panchmansha_chart.chart_url}"
//                   alt="panchmansha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               }  ${
//                 shodashamsha_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Shodashamsha Chart
//                 </p>
//                 <img
//                   src="${shodashamsha_chart.chart_url}"
//                   alt="shodashamsha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 hora_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Hora Chart
//                 </p>
//                 <img
//                   src="${hora_chart.chart_url}"
//                   alt="hora_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 bhamsha_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Bhamsha Chart
//                 </p>
//                 <img
//                   src="${bhamsha_chart.chart_url}"
//                   alt="bhamsha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               } ${
//                 trishamansha_chart.status === true
//                   ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Trishamansha Chart
//                 </p>
//                 <img
//                   src="${trishamansha_chart.chart_url}"
//                   alt="trishamansha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                   : ""
//               }
//             </div>
//           </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>





//        <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] text-center border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Janma Kundli / Navamansha Chart / Other Charts</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Birth Chart, also known as Janma Kundli, is the primary and most
//           important chart in Vedic Astrology. It represents the exact position
//           of all planets at the moment of birth. This chart becomes the
//           foundation of the entire horoscope analysis. and The Navamansha Chart,
//           also known as the D9 chart, is one of the most powerful and respected
//           divisional charts in Vedic Astrology. It is a refined version of the
//           birth chart and shows the inner strength and true potential of
//           planets.
//         </p>
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <div
//             class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]"
//           >
//             <p class="text-center text-[#5E1520] text-[18px] font-medium mb-4">
//               Astrological Charts
//             </p>
//             <hr class="border border-[#F6CFD5] mb-6" />
//             <div class="flex items-center justify-around gap-4 flex-wrap">

//             ${
//               chathurthamasha_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Chathurthamasha Chart
//                 </p>
//                 <img
//                   src="${chathurthamasha_chart.chart_url}"
//                   alt="chathurthamasha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               sun_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Sun Chart
//                 </p>
//                 <img
//                   src="${sun_chart.chart_url}"
//                   alt="sun_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               saptamansha_chart_data.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Saptamansha Chart
//                 </p>
//                 <img
//                   src="${saptamansha_chart_data.chart_url}"
//                   alt="saptamansha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               dwadashamsha_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Dwadashamsha Chart
//                 </p>
//                 <img
//                   src="${dwadashamsha_chart.chart_url}"
//                   alt="dwadashamsha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             }  ${
//               ashtamansha_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Ashtamansha Chart
//                 </p>
//                 <img
//                   src="${ashtamansha_chart.chart_url}"
//                   alt="ashtamansha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               akshvedansha_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Akshvedansha Chart
//                 </p>
//                 <img
//                   src="${akshvedansha_chart.chart_url}"
//                   alt="akshvedansha_chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             }${
//               navamansha_chart_data.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Navamansha Chart
//                 </p>
//                 <img
//                   src="${navamansha_chart_data.chart_url}"
//                   alt="Navamansha Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               chalit_chart_data.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   Chalit Chart
//                 </p>
//                 <img
//                   src="${chalit_chart_data.chart_url}"
//                   alt="chalit Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             } ${
//               chaturvimshamsha_chart.status === true
//                 ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   chaturvimshamsha Chart
//                 </p>
//                 <img
//                   src="${chaturvimshamsha_chart.chart_url}"
//                   alt="chaturvimshamsha Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                 : ""
//             }
//                    ${
//                      dashamansha_chart_data.status === true
//                        ? `
//               <div class="flex flex-col items-center">
//                 <p class="text-[#5E1520] text-[16px] font-medium mb-2">
//                   chaturvimshamsha Chart
//                 </p>
//                 <img
//                   src="${dashamansha_chart_data.chart_url}"
//                   alt="chaturvimshamsha Chart"
//                   class="w-[260px] h-[260px] object-contain border border-[#e5b8b3] rounded-md shadow-md"
//                 />
//               </div>
//               `
//                        : ""
//                    }
//             </div>
//           </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Hora Muhurta Dinman</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           Hora Muhurta Dinman refers to the division of the day and night into
//           planetary hours in Vedic astrology. Each hora (hour) is ruled by a
//           specific planet, which influences the nature and energy of that time.
//           By knowing the planetary hora, one can select the most auspicious time
//           for activities, rituals, or important decisions.
//         </p>
//       </div>
//      <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4">
//     Hora Muhurta Dinman
//   </p>

//   <hr class="border border-[#F6CFD5] mb-4" />

//   <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//     <p class="text-[#5E1520] text-center text-[18px] font-medium">
//       Hora Muhurta Dinman
//     </p>

//     <hr class="border border-[#F6CFD5] mt-2 mb-4" />


//     <p class="text-[#5E1520] font-medium mb-2">🌞 Day Horas</p>

//     <div class="overflow-x-auto">
//       <table class="w-full text-[14px] border-collapse">
//         <thead>
//           <tr class="bg-[#F6CFD5] text-[#5E1520]">
//             <th class="border px-2 py-1">Hora</th>
//             <th class="border px-2 py-1">Time</th>
//           </tr>
//         </thead>

//         <tbody>
//           ${dayHorasmuhurta_dinman
//             .map(
//               (item) => `
//         <tr>
//           <td class="p-2 border">${item?.time?.replace(":", " - ") || "-"}</td>
//           <td class="p-2 border">${item?.hora || "-"}</td>
//         </tr>
//       `,
//             )
//             .join("")}
//         </tbody>
//       </table>
//     </div>



//     <p class="text-[#5E1520] font-medium mt-4 mb-2">🌙 Night Horas</p>

//     <div class="overflow-x-auto">
//       <table class="w-full text-[14px] border-collapse">
//         <thead>
//           <tr class="bg-[#F6CFD5] text-[#5E1520]">
//             <th class="border px-2 py-1">Hora</th>
//             <th class="border px-2 py-1">Time</th>
//           </tr>
//         </thead>

// <tbody>
//   ${(nightHorasmuhurta_dinman || [])
//     .map(
//       (item) => `
//         <tr>
//           <td class="border px-2 py-1">${item?.hora || "-"}</td>
//           <td class="border px-2 py-1">${item?.time || "-"}</td>
//         </tr>
//       `,
//     )
//     .join("")}
// </tbody>
//       </table>
//     </div>
//   </div>
// </div>
//         </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>



//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Jaimini Details</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           Jaimini astrology is a system within Vedic astrology that focuses on
//           special karakas and predictive techniques. The key elements in Jaimini
//           astrology include various karakas (significators) that represent
//           important areas of
//           life:Atmakaraka,Amatyakaraka,Upapada,Putrakaraka,Gnatikaraka,Darakaraka,Chara
//           Rashi
//         </p>
//       </div>
//      <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 h-full p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Jaimini Details
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />



//   <p class="flex items-center justify-between pt-2 text-[14px]">
//     <span class="text-[#5E1520] font-medium">Janma Lagna:</span>
//     <span>${jaimini_details?.janma_lagna}</span>
//   </p>

//   <p class="flex items-center justify-between pt-2 text-[14px]">
//     <span class="text-[#5E1520] font-medium">Pad Lagna:</span>
//     <span>${jaimini_details?.pad_lagna}</span>
//   </p>

//   <p class="flex items-center justify-between pt-2 text-[14px]">
//     <span class="text-[#5E1520] font-medium">Up Pad Lagna:</span>
//     <span>${jaimini_details?.up_pad_lagna}</span>
//   </p>

//   <p class="flex items-center justify-between pt-2 text-[14px]">
//     <span class="text-[#5E1520] font-medium">Kakamsha Lagna:</span>
//     <span>${jaimini_details?.kakamsha_lagna}</span>
//   </p>



//   <p class="text-[#5E1520] font-medium pt-4">Jaimini Karakas:</p>

// ${Object.entries(karakas || {})
//   .map(
//     ([key, value]) => `
//       <p class="flex items-center justify-between pt-2 text-[14px]">
//         <span class="text-[#5E1520] font-medium">
//           ${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:
//         </span>

//         <span>
//           ${value?.planet_name || "-"} (${value?.sign || "-"}) - ${
//             value?.degree ? value.degree.toFixed(2) : "-"
//           }°
//         </span>
//       </p>
//     `,
//   )
//   .join("")}
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >The Panchang Chart</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Panchang Chart shows the placement of planets in the zodiac signs
//           for a given date and time. Each sign lists the planets present, using
//           both full names and abbreviated symbols. This chart helps in
//           understanding planetary influence in each sign and is useful for
//           astrology predictions and calculations.
//         </p>
//       </div>
//  <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Panchang Chart
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="pt-4 space-y-3">
//   ${panchang_chart
//     .map((item) => {
//       const planets =
//         item?.planet?.length > 0
//           ? `${item.planet.join(", ")} (${item?.planet_small?.join("").trim()})`
//           : "-";

//       return `
//         <div class="flex items-center justify-between text-[14px]">
//           <span class="text-[#5E1520] font-medium">
//             ${item.sign_name} (Sign ${item.sign}):
//           </span>

//           <span>${planets}</span>
//         </div>
//       `;
//     })
//     .join("")}
// </div>
// </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Panchang Hora Muhurta Dinman</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Panchang Hora Muhurta Dinman displays the planetary hours (Horas)
//           for both day and night. Each Hora indicates which planet governs that
//           specific time period. This information is used in astrology to
//           determine auspicious and inauspicious times for starting activities,
//           making decisions, or performing rituals.
//         </p>
//       </div>
//      <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Panchang Hora Muhurta Dinman
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />


//   <p class="text-[#5E1520] font-medium mt-4">Day Horas</p>

//   <div class="pt-2 space-y-2">
//     ${dayHorasPanchnag
//       .map(
//         (item, index) => `
//       <div key=${index} class="flex justify-between text-[14px]">
//         <span>${item.hora}</span>
//         <span>${item.time}</span>
//       </div>
//     `,
//       )
//       .join("")}
//   </div>


//   <p class="text-[#5E1520] font-medium mt-4">Night Horas</p>

//   <div class="pt-2 space-y-2">
//     ${nightHorasPanchnag
//       .map(
//         (item, index) => `
//       <div key=${index} class="flex justify-between text-[14px]">
//         <span>${item.hora}</span>
//         <span>${item.time}</span>
//       </div>
//     `,
//       )
//       .join("")}
//   </div>
// </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>
//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Panchang Lagna Table</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Panchang Lagna Table lists the sequence of Lagna (ascendant signs)
//           with their start and end times for a particular day. Each Lagna
//           represents the rising sign at a specific time and affects the
//           energies, opportunities, and auspiciousness during that period.
//           Astrologers use this table to select favorable timings for rituals,
//           important events, travel, or personal decisions.
//         </p>
//       </div>
// <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#006064] text-center text-[18px] font-medium">
//     Panchang Lagna Table
//   </p>

//   <hr class="border border-[#B2EBF2] mt-2" />

//   <div class="mt-4 overflow-x-auto">
//     <table class="w-full table-auto border-collapse border border-[#B2EBF2]">

//       <thead>
//         <tr class="bg-[#B2EBF2]">
//           <th class="border border-[#81D4FA] px-4 py-2 text-left">Lagna</th>
//           <th class="border border-[#81D4FA] px-4 py-2 text-left">Start Time</th>
//           <th class="border border-[#81D4FA] px-4 py-2 text-left">End Time</th>
//         </tr>
//       </thead>

//       <tbody>
//         ${panchang_lagna_table
//           .map(
//             (item, index) => `
//           <tr key={index} class="hover:bg-[#E0F2F1]">
//             <td class="border border-[#81D4FA] px-4 py-2">${item.lagna}</td>

//             <td class="border border-[#81D4FA] px-4 py-2">${item.start_time}</td>

//             <td class="border border-[#81D4FA] px-4 py-2">${item.end_time}</td>
//           </tr>
//        `,
//           )
//           .join("")}
//       </tbody>

//     </table>
//   </div>
// </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Planet Panchang</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Planet Panchang table provides detailed positions of all major
//           planets and the ascendant at a given time. It includes the sign each
//           planet occupies, the Nakshatra and its lord, the degree within the
//           sign, retrograde status, and the house placement. Astrologers use this
//           data to analyze planetary influences on personality, events, health,
//           relationships, and auspicious timings.
//         </p>
//       </div>
// <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#E65100] text-center text-[18px] font-medium">
//     Planet Panchang
//   </p>

//   <hr class="border border-[#FFCC80] mt-2" />

//   <div class="mt-4 overflow-x-auto">
//     <table class="w-full table-auto border-collapse border border-[#FFCC80]">

//       <thead>
//         <tr class="bg-[#FFCC80]">
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Planet</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Sign</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Sign Lord</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra Lord</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Nakshatra Pad</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">House</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Degree</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Retrograde</th>
//           <th class="border border-[#FFD180] px-4 py-2 text-left">Speed</th>
//         </tr>
//       </thead>

//       <tbody>
//         ${planet_panchang
//           .map(
//             (planet) => `
//           <tr key={planet.id} class="hover:bg-[#FFE0B2]">
//             <td class="border border-[#FFD180] px-4 py-2">${planet.name}</td>

//             <td class="border border-[#FFD180] px-4 py-2">${planet.sign}</td>

//             <td class="border border-[#FFD180] px-4 py-2">${planet.signLord}</td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${planet.nakshatra}
//             </td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${planet.nakshatra_lord}
//             </td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${planet.nakshatra_pad}
//             </td>

//             <td class="border border-[#FFD180] px-4 py-2">${planet.house}</td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${planet.fullDegree?.toFixed(3)}°
//             </td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${String(planet.isRetro) === "true" ? "Yes" : "No"}
//             </td>

//             <td class="border border-[#FFD180] px-4 py-2">
//               ${planet.speed?.toFixed(3)}
//             </td>
//           </tr>
//         `,
//           )
//           .join("")}
//       </tbody>

//     </table>
//   </div>
// </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Monthly Panchang</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Monthly Panchang shows the detailed daily Panchang for a specific
//           month and year. It includes information like Tithi (lunar day),
//           Nakshatra, sunrise and sunset timings, helping track auspicious and
//           inauspicious periods, perform rituals, and plan daily activities
//           according to Vedic astrology.
//         </p>
//       </div>
//      <div class="bg-[#E3F2FD] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#1976D2] text-center text-[18px] font-medium">
//     Monthly Panchang - ${monthly_panchang?.month}/${monthly_panchang?.year}
//   </p>

//   <hr class="border border-[#64B5F6] mt-2" />

//   <div class="mt-4 overflow-x-auto">
//     <table class="w-full table-auto border-collapse border border-[#64B5F6]">
//       <thead>
//         <tr class="bg-[#64B5F6] text-white">
//           <th class="border border-[#BBDEFB] px-4 py-2">Day</th>
//           <th class="border border-[#BBDEFB] px-4 py-2">Tithi</th>
//           <th class="border border-[#BBDEFB] px-4 py-2">Nakshatra</th>
//           <th class="border border-[#BBDEFB] px-4 py-2">Sunrise</th>
//           <th class="border border-[#BBDEFB] px-4 py-2">Sunset</th>
//         </tr>
//       </thead>

//       <tbody>
//         ${panchangList
//           .map(
//             (item, index) => `
//           <tr key={index} class="hover:bg-[#BBDEFB]">
//             <td class="border border-[#BBDEFB] px-4 py-2">${item.day}</td>

//             <td class="border border-[#BBDEFB] px-4 py-2">${item.tithi}</td>

//             <td class="border border-[#BBDEFB] px-4 py-2">${item.nak}</td>

//             <td class="border border-[#BBDEFB] px-4 py-2">
//               ${item.sunrise}
//             </td>

//             <td class="border border-[#BBDEFB] px-4 py-2">
//               ${formatTime(item.sunSetTime)}
//             </td>
//           </tr>
//         `,
//           )
//           .join("")}
//       </tbody>
//     </table>
//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Advanced Panchang</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Advanced Panchang section provides a detailed overview of the day
//           according to Vedic astrology. It includes timings for sunrise, sunset,
//           moonrise, and moonset, as well as the Vedic equivalents. Panchang
//           elements such as Tithi, Nakshatra, Yog, Karan, Hindu Maah, Paksha,
//           Ritu, Sun and Moon signs, Ayana, and other astrological factors are
//           provided along with their specific influences, summaries, deities, and
//           auspicious or inauspicious considerations. Additionally, daily time
//           periods like Abhijit Muhurta, Rahu Kaal, Gulik Kaal, and Yamghant Kaal
//           are given to guide auspicious and inauspicious activities.
//         </p>
//       </div>
//      <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#006064] text-center text-[18px] font-medium">
//     Advanced Panchang
//   </p>

//   <hr class="border border-[#B2EBF2] mt-2" />

//   <div class="mt-4">
//     <p class="text-[#006064] font-semibold">Day & Timings:</p>

//     <p class="text-[#006064] mt-1">
//       Day: ${advanced_panchang.day}
//     </p>

//     <p class="text-[#006064] mt-1">
//       Sunrise: ${advanced_panchang.sunrise} | Sunset: ${advanced_panchang.sunset}
//     </p>

//     <p class="text-[#006064] mt-1">
//       Moonrise: ${advanced_panchang.moonrise} | Moonset:${advanced_panchang.moonset}
//     </p>

//     <p class="text-[#006064] mt-1">
//       Vedic Sunrise: ${advanced_panchang.vedic_sunrise} |
//       Vedic Sunset: ${advanced_panchang.vedic_sunset}
//     </p>

//     <div class="mt-4">
//       <p class="text-[#006064] font-semibold">Tithi:</p>

//       <p class="text-[#006064] mt-1">
//         ${tithi.tithi_name} (${tithi.special}) - ${tithi.summary} Deity: ${tithi.deity}
//       </p>

//       <p class="text-[#006064] font-semibold mt-2">Nakshatra:</p>

//       <p class="text-[#006064] mt-1">
//         ${nakshatra.nak_name} - ${nakshatra.summary}
//         Ruler: ${nakshatra.ruler}, Deity: ${nakshatra.deity}
//       </p>

//       <p class="text-[#006064] font-semibold mt-2">Yog:</p>

//       <p class="text-[#006064] mt-1">
//         ${yog.yog_name} - ${yog.special} Meaning: ${yog.meaning}
//       </p>

//       <p class="text-[#006064] font-semibold mt-2">Karan:</p>

//       <p class="text-[#006064] mt-1">
//         ${karan.karan_name} - ${karan.special} Deity:${karan.deity}
//       </p>

//       <p class="text-[#006064] font-semibold mt-2">
//         Other Panchang Details:
//       </p>

//       <p class="text-[#006064] mt-1">
//         Hindu Maah: ${hinduMaah.purnimanta} (Purnimanta & Amanta)
//       </p>

//       <p class="text-[#006064] mt-1">
//         Paksha: ${advanced_panchang.paksha} |
//         Ritu: ${advanced_panchang.ritu} |
//         Sun Sign: ${advanced_panchang.sun_sign} |
//         Moon Sign: ${advanced_panchang.moon_sign} |
//         Ayana: ${advanced_panchang.ayana} |
//         Panchang Yog: ${advanced_panchang.panchang_yog}
//       </p>

//       <p class="text-[#006064] mt-1">
//         Vikram Samvat: ${advanced_panchang.vikram_samvat} (${advanced_panchang.vkram_samvat_name}) |
//         Shaka Samvat: ${advanced_panchang.shaka_samvat} (${advanced_panchang.shaka_samvat_name})
//       </p>

//       <p class="text-[#006064] mt-1">
//         Disha Shool: ${advanced_panchang.disha_shool} |
//         Moon Nivas: ${advanced_panchang.moon_nivas}
//       </p>

//       <p class="text-[#006064] font-semibold mt-2">
//         Auspicious & Inauspicious Timings:
//       </p>

//       <p class="text-[#006064] mt-1">
//         Abhijit Muhurta: ${advanced_panchang?.abhijit_muhurta?.start} - ${advanced_panchang?.abhijit_muhurta?.end}
//       </p>

//       <p class="text-[#006064] mt-1">
//         Rahu Kaal: {advanced_panchang?.rahukaal?.start} - {advanced_panchang?.rahukaal?.end}
//       </p>

//       <p class="text-[#006064] mt-1">
//         Gulik Kaal: ${advanced_panchang?.guliKaal?.start} - ${advanced_panchang?.guliKaal?.end}
//       </p>

//       <p class="text-[#006064] mt-1">
//         Yamghant Kaal: ${advanced_panchang?.yamghant_kaal?.start} - ${advanced_panchang?.yamghant_kaal?.end}
//       </p>
//     </div>
//   </div>
// </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Planets</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           In Vedic astrology, planets are known as Grahas, derived from the
//           Sanskrit word meaning "seizer" or "influencer." These celestial bodies
//           are considered the primary forces that shape human life, destiny, and
//           personality. The Grahas do not just influence external events but also
//           govern internal tendencies, emotional patterns, and karmic lessons.
//           Every planet has unique characteristics, energies, and symbolism, and
//           their placement in a person's birth chart (Janma Kundli) — in terms of
//           both signs (Rashi) and houses (Bhav) — determines how they manifest in
//           life.
//         </p>
//       </div>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//         <p
//           class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4"
//         >
//           Planets in Your Kundli
//         </p>
//         <hr class="border border-[#F6CFD5] mb-4" />
//         ${
//           planets_data.length > 0
//             ? `
//         <div class="overflow-x-auto">
//           <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//             <thead>
//               <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                 <th class="p-2 border">Planet</th>
//                 <th class="p-2 border">Sign</th>
//                 <th class="p-2 border">Degree</th>
//                 <th class="p-2 border">Sign Lord</th>
//                 <th class="p-2 border">Nakshatra</th>
//                 <th class="p-2 border">Nakshatra Lord</th>
//                 <th class="p-2 border">Nakshatra Pad</th>
//                 <th class="p-2 border">House</th>
//                 <th class="p-2 border">Planet Awastha</th>
//                 <th class="p-2 border">Retrograde</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${planets_data
//                 .filter(
//                   (p) =>
//                     p.name !== "Ascendant" &&
//                     !["URANUS", "NEPTUNE", "PLUTO"].includes(p.name),
//                 )
//                 .map(
//                   (p) => `
//               <tr class="text-[#504E4F] ">
//                 <td class="p-2 border">${p.name || "-"}</td>
//                 <td class="p-2 border">${p.sign || "-"}</td>
//                 <td class="p-2 border">
//                   ${p.fullDegree ? p.fullDegree.toFixed(4) : "-"}
//                 </td>
//                 <td class="p-2 border">${p.signLord || "-"}</td>
//                 <td class="p-2 border">${p.nakshatra || "-"}</td>
//                 <td class="p-2 border">${p.nakshatraLord || "-"}</td>
//                 <td class="p-2 border">${p.nakshatra_pad || "-"}</td>
//                 <td class="p-2 border">${p.house || "-"}</td>
//                 <td class="p-2 border">${p.planet_awastha || "-"}</td>
//                 <td class="p-2 border">${p.isRetro || "-"}</td>
//               </tr>
//               `,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//         </div>
//         `
//             : ""
//         }
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>



//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Lalkitab Remedies</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Lal Kitab Remedies shows the position of planets in the 12 zodiac
//           signs according to the Lal Kitab system. It highlights which planets
//           influence each sign, helping understand strengths, weaknesses, and
//           life tendencies. The chart shows both the full planetary names and
//           short forms for quick reference.
//         </p>
//       </div>
// <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#FB8C00] text-center text-[18px] font-medium">
//     Lal Kitab Remedies
//   </p>

//   <hr class="border border-[#FFB74D] mt-2" />

//   <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

//     ${Object.values(lalkitab_remedies)
//       .slice(0, 4)
//       .map(
//         (planetData, index) => `
//       <div key={index} class="bg-[#FFE0B2] p-4 rounded-lg shadow-md">
//         <p class="font-semibold text-[#E65100]">
//           ${planetData?.planet} - ${planetData?.house} House
//         </p>

//         <p class=" mt-2">${planetData?.lal_kitab_desc}</p>

//         <ul class="list-disc pl-5 mt-2 ">
//           ${planetData?.lal_kitab_remedies
//             ?.map(
//               (remedy, i) => `
//             <li key=${i}>${remedy}</li>
//          `,
//             )
//             .join("")}
//         </ul>
//       </div>
//     `,
//       )
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>



//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
// <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#FB8C00] text-center text-[18px] font-medium">
//     Lal Kitab Remedies
//   </p>

//   <hr class="border border-[#FFB74D] mt-2" />

//   <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

//     ${Object.values(lalkitab_remedies)
//       .slice(4)
//       .map(
//         (planetData, index) => `
//       <div key={index} class="bg-[#FFE0B2] p-4 rounded-lg shadow-md">
//         <p class="font-semibold text-[#E65100]">
//           ${planetData?.planet} - ${planetData?.house} House
//         </p>

//         <p class=" mt-2">${planetData?.lal_kitab_desc}</p>

//         <ul class="list-disc pl-5 mt-2 ">
//           ${planetData?.lal_kitab_remedies
//             ?.map(
//               (remedy, i) => `
//             <li key=${i}>${remedy}</li>
//          `,
//             )
//             .join("")}
//         </ul>
//       </div>
//     `,
//       )
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>



//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Lalkitab Horoscope</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Lal Kitab Horoscope shows the position of planets in the 12 zodiac
//           signs according to the Lal Kitab system. It highlights which planets
//           influence each sign, helping understand strengths, weaknesses, and
//           life tendencies. The chart shows both the full planetary names and
//           short forms for quick reference.
//         </p>
//       </div>
//     <div class="bg-[#FFDBC25C] w-[80%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Lal Kitab Horoscope
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4">
//     <table class="w-full text-left border-collapse">
//       <thead>
//         <tr class="bg-[#F6CFD5]">
//           <th class="border px-3 py-2">Sign</th>
//           <th class="border px-3 py-2">Planets</th>
//           <th class="border px-3 py-2">Short Forms</th>
//         </tr>
//       </thead>

//       <tbody>
//         ${lalkitab_horoscope
//           .map(
//             (item, index) => `
//           <tr key={index}>
//             <td class="border px-3 py-2">${item?.sign_name}</td>

//             <td class="border px-3 py-2">
//               ${item?.planet?.length ? item.planet.join(", ") : "-"}
//             </td>

//             <td class="border px-3 py-2">
//               ${item?.planet_small?.length ? item.planet_small.join(", ") : "-"}
//             </td>
//           </tr>
//         `,
//           )
//           .join("")}
//       </tbody>
//     </table>
//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Sarvashtak</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Sarvashtak Varga is a traditional Vedic astrology chart used to
//           assess planetary strengths across the 12 zodiac signs. Each planet
//           contributes points to each sign, and the total points indicate the
//           overall influence of planets in that sign. A higher score represents
//           stronger planetary support, while lower scores indicate challenges or
//           weaker influences. This chart helps astrologers predict favorable and
//           unfavorable periods, life events, and general fortune.
//         </p>
//       </div>
//     <div class="bg-[#FFDBC25C] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Sarvashtak Varga
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4 overflow-x-auto">
//     <table class="w-full text-left border-collapse">
//       <thead>
//         <tr class="bg-[#F6CFD5]">
//           <th class="border px-2 py-2">Sign</th>
//           <th class="border px-2 py-2">Sun</th>
//           <th class="border px-2 py-2">Moon</th>
//           <th class="border px-2 py-2">Mars</th>
//           <th class="border px-2 py-2">Mercury</th>
//           <th class="border px-2 py-2">Jupiter</th>
//           <th class="border px-2 py-2">Venus</th>
//           <th class="border px-2 py-2">Saturn</th>
//           <th class="border px-2 py-2">Ascendant</th>
//           <th class="border px-2 py-2">Total</th>
//         </tr>
//       </thead>

//       <tbody>
//         ${Object.entries(ashtakPoints)
//           .map(
//             ([sign, value], index) => `
//           <tr key={index}>
//             <td class="border px-2 py-1 capitalize">${sign}</td>

//             <td class="border px-2 py-1">${value.sun}</td>
//             <td class="border px-2 py-1">${value.moon}</td>
//             <td class="border px-2 py-1">${value.mars}</td>
//             <td class="border px-2 py-1">${value.mercury}</td>
//             <td class="border px-2 py-1">${value.jupiter}</td>
//             <td class="border px-2 py-1">${value.venus}</td>
//             <td class="border px-2 py-1">${value.saturn}</td>
//             <td class="border px-2 py-1">${value.ascendant}</td>
//             <td class="border px-2 py-1 font-semibold">${value.total}</td>
//           </tr>
//         `,
//           )
//           .join("")}
//       </tbody>
//     </table>
//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Bhav Madhya</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Bhav Madhya represents the midpoints of the twelve astrological
//           houses in a horoscope. Each house governs a specific area of
//           life—personality, wealth, communication, family, career, and so on.
//           Ascendant (Lagna) marks the start of the 1st house, representing the
//           self. Midheaven (MC) indicates the 10th house cusp, related to career
//           and public life. Ayanamsha is the correction for precession of the
//           equinoxes in Vedic astrology. The chart includes: Bhav Madhya – exact
//           midpoint of each house with degree and zodiac sign.
//         </p>
//       </div>
//       <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//         <p class="text-[#5E1520] text-center text-[18px] font-medium">
//           Bhav Madhya & Sandhi
//         </p>
//         <hr class="border border-[#F6CFD5] mt-2" />

//         <!-- Bhav Madhya Table -->
//         <div class="mt-4 overflow-x-auto">
//           <table class="w-full text-left border-collapse">
//             <thead>
//               <tr class="bg-[#F6CFD5]">
//                 <th class="border px-2 py-2">House</th>
//                 <th class="border px-2 py-2">Sign</th>
//                 <th class="border px-2 py-2">Degree</th>
//                 <th class="border px-2 py-2">Normalized Degree</th>
//               </tr>
//             </thead>
//          <tbody>
//   ${madhyaList
//     .map(
//       (item, index) => `
//     <tr key={index}>
//       <td class="border px-2 py-1">${item.house}</td>
//       <td class="border px-2 py-1">${item.sign}</td>
//       <td class="border px-2 py-1">${item.degree.toFixed(2)}°</td>
//       <td class="border px-2 py-1">${item.norm_degree.toFixed(2)}°</td>
//     </tr>
//   `,
//     )
//     .join("")}
// </tbody>
//           </table>

//           <!-- Bhav Sandhi Table -->
//           <p class="mt-6 text-[#5E1520] font-medium text-[16px]">
//             Bhav Sandhi (Cusp Transitions)
//           </p>
//           <table class="w-full text-left border-collapse mt-2">
//             <thead>
//               <tr class="bg-[#F6CFD5]">
//                 <th class="border px-2 py-2">House</th>
//                 <th class="border px-2 py-2">Sign</th>
//                 <th class="border px-2 py-2">Degree</th>
//                 <th class="border px-2 py-2">Normalized Degree</th>
//               </tr>
//             </thead>
//          <tbody>
//   ${sandhiList
//     .map(
//       (item, index) => `
//     <tr key={index}>
//       <td class="border px-2 py-1">${item.house}</td>
//       <td class="border px-2 py-1">${item.sign}</td>
//       <td class="border px-2 py-1">${item.degree.toFixed(2)}°</td>
//       <td class="border px-2 py-1">${item.norm_degree.toFixed(2)}°</td>
//     </tr>
//  `,
//     )
//     .join("")}
// </tbody>
//           </table>
//         </div>
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Moon Biorhythm</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Moon Biorhythm represents the daily activity cycle based on the
//           native's birth Pakshi (Moon bird). It details the time segments of the
//           day and night, showing the most favorable activities such as sleeping,
//           ruling, walking, eating, or cautionary periods. The Pakshi
//           characteristics also include friendly and enemy birds, ruling days,
//           associated colors, and directions, which influence daily energy,
//           decision-making, and mood.
//         </p>
//       </div>
//    <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#006064] text-center text-[18px] font-medium">
//     Moon Biorhythm
//   </p>

//   <hr class="border border-[#4DD0E1] mt-2" />

//   <div class="mt-4">
//     <p class="text-[#006064] font-semibold">Birth Pakshi</p>

//     <p class="text-[#006064] mt-1">
//       <span class="font-medium">Name:</span> ${moon_biorhythm.birth_pakshi}<br/>

//       <span class="font-medium">Color:</span> ${moon_biorhythm.birth_pakshi_details.color}<br/>

//       <span class="font-medium">Direction:</span> ${moon_biorhythm.birth_pakshi_details.direction}<br/>

//       <span class="font-medium">Friendly Birds:</span>
//       ${moon_biorhythm.birth_pakshi_details.friend.join(", ")}<br/>

//       <span class="font-medium">Enemy Birds:</span>
//       ${moon_biorhythm.birth_pakshi_details.enemy.join(", ")}<br/>

//       <span class="font-medium">Name Letters:</span>
//       ${moon_biorhythm.birth_pakshi_details.name_letter.join(", ")}<br/>

//       <span class="font-medium">Death Days:</span>
//       ${moon_biorhythm.birth_pakshi_details.death_day.join(", ")}<br/>

//       <span class="font-medium">Day Ruling Days:</span>
//       ${moon_biorhythm.birth_pakshi_details.day_ruling_days.join(", ")}<br/>

//       <span class="font-medium">Night Ruling Days:</span>
//       ${moon_biorhythm.birth_pakshi_details.night_ruling_days.join(", ")}
//     </p>

//     <div class="mt-4 overflow-x-auto">
//       <table class="w-full table-auto border-collapse border border-[#4DD0E1]">
//         <thead>
//           <tr class="bg-[#4DD0E1]">
//             <th class="border border-[#B2EBF2] px-4 py-2 text-left">Time Period</th>
//             <th class="border border-[#B2EBF2] px-4 py-2 text-left">Activity</th>
//             <th class="border border-[#B2EBF2] px-4 py-2 text-left">Meaning</th>
//             <th class="border border-[#B2EBF2] px-4 py-2 text-left">Start Time</th>
//             <th class="border border-[#B2EBF2] px-4 py-2 text-left">End Time</th>
//           </tr>
//         </thead>

//         <tbody>

//           ${moon_biorhythm.activity_cycle.day
//             .map(
//               (item) => `
//             <tr class="hover:bg-[#B2EBF2]">
//               <td class="border border-[#B2EBF2] px-4 py-2">Day</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.activity}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.activity_meaning}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.start_time}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.end_time}</td>
//             </tr>
//           `,
//             )
//             .join("")}

//           ${moon_biorhythm.activity_cycle.night
//             .map(
//               (item) => `
//             <tr class="hover:bg-[#B2EBF2]">
//               <td class="border border-[#B2EBF2] px-4 py-2">Night</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.activity}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.activity_meaning}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.start_time}</td>
//               <td class="border border-[#B2EBF2] px-4 py-2">${item.end_time}</td>
//             </tr>
//           `,
//             )
//             .join("")}

//         </tbody>
//       </table>
//     </div>

//     <p class="text-[#006064] mt-2 text-right">
//       <span class="font-medium">Date Considered:</span>
//       ${moon_biorhythm.considered_date}
//     </p>

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Lalkitab Debts</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Lalkitab Debts section describes karmic obligations or "debts" a
//           native may carry according to Vedic astrology. These debts are
//           believed to influence behavior, relationships, and life events. Each
//           type of debt comes with indications, which are signs or actions that
//           reveal the existence of the debt, and events, which are possible
//           outcomes or situations that may occur if the debt is unresolved. For
//           example, debts to relatives reflect obligations or issues with family
//           members, often linked to past misdeeds or strained relationships.
//           Debts to females indicate karma related to women, including issues
//           with fairness, respect, or obligations toward female relatives. By
//           understanding these debts, astrologers can guide remedies, lifestyle
//           adjustments, or rituals to reduce their negative impact.
//         </p>
//       </div>
//   <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Lalkitab Debts
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4">

//     ${lalkitab_debts
//       ?.map(
//         (debt) => `

//       <div class="mb-4">
//         <p class="text-[#5E1520] font-semibold">
//           ${debt.debt_name || "-"}
//         </p>

//         <p class="text-[#5E1520] mt-1">
//           <span class="font-medium">Indications:</span>
//           ${debt.indications || "-"}
//         </p>

//         <p class="text-[#5E1520] mt-1">
//           <span class="font-medium">Events:</span>
//           ${debt.events || "-"}
//         </p>
//       </div>

//     `,
//       )
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Lalkitab Houses</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Lalkitab Houses section provides a detailed overview of the twelve
//           houses (khana) in a horoscope, describing the planetary influences,
//           strengths, and weaknesses associated with each house. Each house is
//           characterized by its ruler (maalik), the "pakka ghar" which indicates
//           a fixed or strong planetary association, and "kismat" which reflects
//           the planet governing fortune or destiny in that house. Some houses are
//           marked as "soya," indicating a sleeping or dormant energy in that area
//           of life. Additionally, each house lists the planets that are exalted
//           or debilitated in it, showing which planetary influences are
//           especially strong or weak in that house. For example, the first house
//           is ruled by Mars, has the Sun as its pakka ghar, Mars as its kismat,
//           and shows the Sun exalted and Saturn debilitated. The second house is
//           ruled by Venus, with Jupiter as pakka ghar and Moon as kismat, and it
//           indicates the Moon and Rahu as exalted planets. This pattern continues
//           for all twelve houses, providing a comprehensive framework for
//           understanding how planetary positions influence various aspects of
//           life, from personality and health to fortune, relationships, and
//           career.
//         </p>
//       </div>
//  <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Lalkitab Houses
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4 space-y-6">

//     ${(lalkitab_houses || [])
//       .slice(0, 4)
//       .map((house) => {
//         const exalt = Array.isArray(house.exalt)
//           ? house.exalt.join(", ")
//           : house.exalt || "-";

//         const debilitated = Array.isArray(house.debilitated)
//           ? house.debilitated.join(", ")
//           : house.debilitated || "-";

//         return `
//         <div class="mb-4 border-b border-[#F6CFD5] pb-4">

//           <p class="text-[#5E1520] font-semibold">
//             House ${house.khana_number || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Maalik:</span>
//             ${house.maalik || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Pakka Ghar:</span>
//             ${house.pakka_ghar || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Kismat:</span>
//             ${house.kismat || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Soya:</span>
//             ${house.soya ? "Yes" : "No"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Exalted:</span>
//             ${exalt}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Debilitated:</span>
//             ${debilitated}
//           </p>

//         </div>
//       `;
//       })
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>


//       <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >

//  <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Lalkitab Houses
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4 space-y-6">

//     ${(lalkitab_houses || [])
//       .slice(4, 8)
//       .map((house) => {
//         const exalt = Array.isArray(house.exalt)
//           ? house.exalt.join(", ")
//           : house.exalt || "-";

//         const debilitated = Array.isArray(house.debilitated)
//           ? house.debilitated.join(", ")
//           : house.debilitated || "-";

//         return `
//         <div class="mb-4 border-b border-[#F6CFD5] pb-4">

//           <p class="text-[#5E1520] font-semibold">
//             House ${house.khana_number || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Maalik:</span>
//             ${house.maalik || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Pakka Ghar:</span>
//             ${house.pakka_ghar || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Kismat:</span>
//             ${house.kismat || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Soya:</span>
//             ${house.soya ? "Yes" : "No"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Exalted:</span>
//             ${exalt}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Debilitated:</span>
//             ${debilitated}
//           </p>

//         </div>
//       `;
//       })
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//       <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >

//  <div class="bg-[#FFE5B4] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#5E1520] text-center text-[18px] font-medium">
//     Lalkitab Houses
//   </p>

//   <hr class="border border-[#F6CFD5] mt-2" />

//   <div class="mt-4 space-y-6">

//     ${(lalkitab_houses || [])
//       .slice(8)
//       .map((house) => {
//         const exalt = Array.isArray(house.exalt)
//           ? house.exalt.join(", ")
//           : house.exalt || "-";

//         const debilitated = Array.isArray(house.debilitated)
//           ? house.debilitated.join(", ")
//           : house.debilitated || "-";

//         return `
//         <div class="mb-4 border-b border-[#F6CFD5] pb-4">

//           <p class="text-[#5E1520] font-semibold">
//             House ${house.khana_number || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Maalik:</span>
//             ${house.maalik || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Pakka Ghar:</span>
//             ${house.pakka_ghar || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Kismat:</span>
//             ${house.kismat || "-"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Soya:</span>
//             ${house.soya ? "Yes" : "No"}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Exalted:</span>
//             ${exalt}
//           </p>

//           <p class="text-[#5E1520] mt-1">
//             <span class="font-medium">Debilitated:</span>
//             ${debilitated}
//           </p>

//         </div>
//       `;
//       })
//       .join("")}

//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Daily Nakshatra Prediction</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Daily Nakshatra Prediction provides personalized guidance based on
//           the Moon sign and Nakshatra of birth. It covers multiple aspects of
//           life including health, emotions, profession, luck, personal life, and
//           travel. These predictions are intended to give insights into the day,
//           suggesting actions or attitudes to enhance well-being, success, and
//           harmony. Each category highlights specific advice or potential events,
//           helping the native make informed decisions for the day.
//         </p>
//       </div>
//      <div class="bg-[#E0F7FA] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">

//   <p class="text-[#00796B] text-center text-[18px] font-medium">
//     Daily Nakshatra Prediction
//   </p>

//   <hr class="border border-[#B2DFDB] mt-2" />

//   <div class="mt-4">

//     <p class="text-[#00796B] font-semibold">Birth Moon Sign:</p>
//     <p class="text-[#00796B] mt-1">
//       ${daily_nakshatra_prediction?.birth_moon_sign || "-"}
//     </p>

//     <p class="text-[#00796B] font-semibold mt-3">Birth Moon Nakshatra:</p>
//     <p class="text-[#00796B] mt-1">
//       ${daily_nakshatra_prediction?.birth_moon_nakshatra || "-"}
//     </p>

//     <p class="text-[#00796B] font-semibold mt-3">Prediction Date:</p>
//     <p class="text-[#00796B] mt-1">
//       ${daily_nakshatra_prediction?.prediction_date || "-"}
//     </p>


//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Health</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.health || "-"}
//       </p>
//     </div>

//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Emotions</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.emotions || "-"}
//       </p>
//     </div>

//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Profession</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.profession || "-"}
//       </p>
//     </div>

//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Luck</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.luck || "-"}
//       </p>
//     </div>

//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Personal Life</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.personal_life || "-"}
//       </p>
//     </div>

//     <div class="mt-4">
//       <p class="text-[#00796B] font-semibold">Travel</p>
//       <p class="text-[#00796B] mt-1">
//         ${prediction?.travel || "-"}
//       </p>
//     </div>

//   </div>

// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>


//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Vimshottari Dasha</span
//         >
//       </div>
//       <div class="h-[85%]">
//         <div>
//           <p class="text-center text-[#504E4F] pt-6">
//             Vimshottari Dasha literally means "the planetary period system of
//             120 years". In Vedic astrology, it is the most widely used Dasha
//             system to predict the timing of events in a person's life. It is
//             based on the Moon's position at birth, as the Moon represents the
//             mind, emotions, and internal experiences. Unlike Western astrology,
//             which primarily focuses on the Sun sign, Vedic astrology uses Moon
//             Nakshatra (lunar mansion) to determine the planetary periods. The
//             total duration of all planetary periods in Vimshottari Dasha is 120
//             years, which is considered the average human lifespan according to
//             classical astrology.
//           </p>
//         </div>
//         <div class="overflow-x-auto mt-6 bg-[#FFDBC25C] p-6 rounded">
//           <p
//             class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4"
//           >
//             Maha Vimshottari Dasha
//           </p>
//           <hr class="border border-[#F6CFD5] mb-4" />
//           ${
//             vimshottri_major_vdasha_data.length > 0
//               ? `
//           <table class="w-full text-[13px]">
//             <thead>
//               <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                 <th class="p-2 border">Planet</th>
//                 <th class="p-2 border">Start Date</th>
//                 <th class="p-2 border">End Date</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${vimshottri_major_vdasha_data
//                 .map(
//                   (d) => `
//               <tr class="text-[#504E4F] ">
//                 <td class="p-2 border">${d.planet || "-"}</td>
//                 <td class="p-2 border">${formatDate(d.start)}</td>
//                 <td class="p-2 border">${formatDate(d.end)}</td>
//               </tr>
//               `,
//                 )
//                 .join("")}
//             </tbody>
//           </table>
//           `
//               : ""
//           }
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >KP (Krishnamurti Paddhati)</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           KP (Krishnamurti Paddhati) Astrology is a highly precise system that
//           focuses on stellar, sub-lord, and cusp analysis to give accurate
//           predictions. Unlike traditional Vedic astrology, KP simplifies
//           concepts using Placidus house division, ruling planets, and sub-lord
//           results. It is widely used for timing events related to career,
//           marriage, property, health, travel, and overall life outcomes. Each
//           cusp (house) is influenced by a star lord and sub-lord, determining
//           exactly how that area of life unfolds. KP emphasizes the relationship
//           between the promise, significators, and timing of events through
//           Vimshottari Dasha. With its systematic and scientific approach, KP
//           provides quick and reliable insights into practical life situations.
//         </p>
//       </div>
//       <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 p-6 rounded-[11px]">
//         ${kpBasicHTML} ${kpPlanetsHTML} ${kpHousesHTML} ${
//           kp_planets_data && kp_planets_data.length > 0
//             ? `
//         <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//           <p
//             class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4"
//           >
//             KP Planets
//           </p>
//           <hr class="border border-[#F6CFD5] mb-4" />

//           <div class="overflow-x-auto">
//             <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//               <thead>
//                 <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                   <th class="p-2 border">Planet</th>
//                   <th class="p-2 border">Sign</th>
//                   <th class="p-2 border">Degree</th>
//                   <th class="p-2 border">Formatted Degree</th>
//                   <th class="p-2 border">Norm Degree</th>
//                   <th class="p-2 border">Formatted Norm Degree</th>
//                   <th class="p-2 border">Sign Lord</th>
//                   <th class="p-2 border">Nakshatra</th>
//                   <th class="p-2 border">Nakshatra Lord</th>
//                   <th class="p-2 border">Charan</th>
//                   <th class="p-2 border">Sub Lord</th>
//                   <th class="p-2 border">Sub Sub Lord</th>
//                   <th class="p-2 border">House</th>
//                   <th class="p-2 border">Retrograde</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 ${kp_planets_data
//                   .map(
//                     (p) => `
//                 <tr class="text-[#504E4F] ">
//                   <td class="p-2 border">${p.planet_name || "-"}</td>
//                   <td class="p-2 border">${p.sign || "-"}</td>
//                   <td class="p-2 border">${p.degree?.toFixed(4) || "-"}</td>
//                   <td class="p-2 border">${p.formatted_degree || "-"}</td>
//                   <td class="p-2 border">
//                     ${p.norm_degree?.toFixed(4) || "-"}
//                   </td>
//                   <td class="p-2 border">${p.formatted_norm_degree || "-"}</td>
//                   <td class="p-2 border">${p.sign_lord || "-"}</td>
//                   <td class="p-2 border">${p.nakshatra || "-"}</td>
//                   <td class="p-2 border">${p.nakshatra_lord || "-"}</td>
//                   <td class="p-2 border">${p.charan ?? "-"}</td>
//                   <td class="p-2 border">${p.sub_lord || "-"}</td>
//                   <td class="p-2 border">${p.sub_sub_lord || "-"}</td>
//                   <td class="p-2 border">${p.house ?? "-"}</td>
//                   <td class="p-2 border">${p.is_retro ? "Yes" : "No"}</td>
//                 </tr>
//                 `,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         </div>
//         `
//             : ""
//         }
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div>
//         ${
//           kp_house_cusps_data && kp_house_cusps_data.length > 0
//             ? `
//         <div class="bg-[#FFDBC25C] w-full mx-auto mt-8 p-6 rounded-[11px]">
//           <p
//             class="text-[#5E1520] text-center text-[18px] heading_font font-semibold mb-4"
//           >
//             KP House Cusps
//           </p>
//           <hr class="border border-[#F6CFD5] mb-4" />

//           <div class="overflow-x-auto">
//             <table class="w-full text-[12px] border border-[#e5b8b3] rounded">
//               <thead>
//                 <tr class="bg-[#F6CFD5] text-[#5E1520] heading_font">
//                   <th class="p-2 border">House</th>
//                   <th class="p-2 border">Cusp Degree</th>
//                   <th class="p-2 border">Formatted Degree</th>
//                   <th class="p-2 border">Sign</th>
//                   <th class="p-2 border">Sign Lord</th>
//                   <th class="p-2 border">Nakshatra</th>
//                   <th class="p-2 border">Nakshatra Lord</th>
//                   <th class="p-2 border">Sub Lord</th>
//                   <th class="p-2 border">Sub Sub Lord</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 ${kp_house_cusps_data
//                   .map(
//                     (h) => `
//                 <tr class="text-[#504E4F] ">
//                   <td class="p-2 border">${h.house_id ?? "-"}</td>
//                   <td class="p-2 border">
//                     ${h.cusp_full_degree?.toFixed(4) || "-"}
//                   </td>
//                   <td class="p-2 border">${h.formatted_degree || "-"}</td>
//                   <td class="p-2 border">${h.sign || "-"}</td>
//                   <td class="p-2 border">${h.sign_lord || "-"}</td>
//                   <td class="p-2 border">${h.nakshatra || "-"}</td>
//                   <td class="p-2 border">${h.nakshatra_lord || "-"}</td>
//                   <td class="p-2 border">${h.sub_lord || "-"}</td>
//                   <td class="p-2 border">${h.sub_sub_lord || "-"}</td>
//                 </tr>
//                 `,
//                   )
//                   .join("")}
//               </tbody>
//             </table>
//           </div>
//         </div>
//         `
//             : ""
//         }
//       </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>
//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Yogini Dasha</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           Yogini Dasha is a unique planetary timing system in Vedic astrology.
//           It divides a person's life into periods ruled by specific Yoginis,
//           which influence events, experiences, and overall life direction. Each
//           Yogini period is associated with certain characteristics, strengths,
//           challenges, and karmic lessons. Astrologers use Yogini Dasha to
//           predict favorable and unfavorable times, guiding personal,
//           professional, and spiritual decisions. The sequence and duration of
//           each Yogini period depend on the natal chart and Nakshatra placements.
//         </p>
//       </div>
//    <div class="bg-[#FFDBC25C] w-full mx-auto mt-10 p-6 rounded-[11px] shadow-md">
//     <p
//       class="text-[#5E1520] text-center text-[22px] heading_font font-semibold mb-3"
//     >
//       Sub-Yogini Dasha
//     </p>
//     <p class="text-center text-[#5E1520]  mb-5 opacity-80">
//       Major periods with sub-periods • Horizontal scroll to view all
//     </p>
//     <hr class="border border-[#F6CFD5] mb-6" />

//     <div class="overflow-x-auto pb-4">
//       <div class="flex gap-6 px-1 min-w-max">
//         ${
//           sub_yogini_dasha && sub_yogini_dasha.length > 0
//             ? sub_yogini_dasha
//                 .map((item, index) => {
//                   const major = item.major_dasha;
//                   const isCurrent =
//                     major.start_ms <= currentTimestamp &&
//                     major.end_ms >= currentTimestamp;

//                   return `
//           <div class="
//             bg-white/${isCurrent ? "90" : "80"}
//             backdrop-blur-sm
//             border ${isCurrent ? "border-2 border-[#d9534f]/40 ring-1 ring-rose-300/50 shadow-lg" : "border-[#F6CFD5] shadow-sm"}
//             rounded-xl
//             min-w-[340px]
//             max-w-[${isCurrent ? "380" : "360"}px]
//             flex flex-col overflow-hidden
//             relative
//           ">
//             ${
//               isCurrent
//                 ? `
//             <div class="absolute -top-2 -right-2 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-bl-lg rounded-tr-lg shadow">
//               Current
//             </div>
//             `
//                 : ""
//             }

//             <div class="card-header px-5 py-4">
//               <h3 class="text-[#5E1520] heading_font font-semibold text-[17px]">
//                 ${major.dasha_name}
//                 <span class="text-[14px] opacity-80">(Major)</span>
//               </h3>
//               <p class="text-[#5E1520] text-[13px] mt-1">
//                 ${major.start_date} – ${major.end_date} •
//                 <span class="font-medium">${major.duration} year${major.duration > 1 ? "s" : ""}</span>
//               </p>
//             </div>

//             <div class="p-4 text-[13.5px] text-gray-700 flex-1">
//               <div class="space-y-2.5 divide-y divide-rose-100/70">
//                 ${item.sub_dasha
//                   .map((sub, subIndex) => {
//                     const isLast = subIndex === item.sub_dasha.length - 1;
//                     const isBold =
//                       isLast || sub.dasha_name === major.dasha_name;

//                     return `
//                 <div class="flex justify-between py-1.5 sub-row ${isBold ? "font-medium text-[#5E1520]" : ""}">
//                   <span>${sub.dasha_name}</span>
//                   <span>${sub.start_date} – ${sub.end_date}</span>
//                 </div>
//                 `;
//                   })
//                   .join("")}
//               </div>
//             </div>
//           </div>
//         `;
//                 })
//                 .join("")
//             : '<p class="text-center text-gray-600 py-8">No Yogini Dasha data available</p>'
//         }
//       </div>
//     </div>
//   </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>

//     <section
//       class="min-h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="flex items-center justify-center mt-10">
//         <span
//           class="text-[#FF7010] border border-[#FF7010] border-dashed px-6 text-[28px] rounded-[4px] heading_font py-2"
//           >Major Yogini Dasha</span
//         >
//       </div>
//       <div>
//         <p class="text-center text-[#504E4F] pt-6">
//           The Major Yogini Dasha represents the planetary periods in cycles,
//           showing the start and end dates of each Yogini Dasha. Each Dasha has a
//           specific duration in years and influences the native's life events,
//           personality growth, and karmic patterns. This system helps in
//           predicting favorable and challenging periods in life.
//         </p>
//       </div>
// <div class="bg-[#FFF3E0] w-[90%] mx-auto mt-10 p-6 rounded-[11px]">
//   <p class="text-[#E65100] text-center text-[18px] font-medium">
//     Major Yogini Dasha
//   </p>

//   <hr class="border border-[#FFB74D] mt-2" />

//   <div class="mt-4 overflow-x-auto">
//     <table class="w-full table-auto border-collapse border border-[#FFB74D]">

//       <thead>
//         <tr class="bg-[#FFB74D]">
//           <th class="border border-[#FFE0B2] px-4 py-2 text-left">
//             Dasha Name
//           </th>
//           <th class="border border-[#FFE0B2] px-4 py-2 text-left">
//             Start Date
//           </th>
//           <th class="border border-[#FFE0B2] px-4 py-2 text-left">
//             End Date
//           </th>
//           <th class="border border-[#FFE0B2] px-4 py-2 text-left">
//             Duration (Years)
//           </th>
//         </tr>
//       </thead>

//       <tbody>
//         ${major_yogini_dasha
//           .map(
//             (dasha, index) => `
//           <tr key=${index} class="hover:bg-[#FFE0B2]">
//             <td class="border border-[#FFE0B2] px-4 py-2">
//               ${dasha.dasha_name}
//             </td>

//             <td class="border border-[#FFE0B2] px-4 py-2">
//               ${dasha.start_date}
//             </td>

//             <td class="border border-[#FFE0B2] px-4 py-2">${dasha.end_date}</td>

//             <td class="border border-[#FFE0B2] px-4 py-2">${dasha.duration}</td>
//           </tr>
//        `,
//           )
//           .join("")}
//       </tbody>

//     </table>
//   </div>
// </div>

//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>
//     <section
//       class="h-[100vh] py-10 p-6 bg-contain bg-center bg-norepeat relative"
//       style="background-image: url(&quot;${backgroundImage}&quot;)"
//     >
//       <div class="h-[85%]">
//         <div>
//           <div
//             class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]"
//           >
//             <p class="text-center text-[#504E4F] pt-6">
//               This Kundli report is based on Vedic astrology principles, aimed
//               at guiding and motivating you. However, it should not be
//               considered a substitute for professional advice in important
//               matters such as health, legal issues, or work-related decisions.
//               We have prepared this report carefully and with good intentions,
//               but we cannot be held responsible for any decisions you make based
//               on this information. We hope that these astrology insights prove
//               to be useful and beneficial in your life.
//             </p>
//           </div>
//           <div
//             class="bg-[#FFDBC25C] w-full mx-auto mt-10 h-full p-6 rounded-[11px]"
//           >
//             <p class="text-center text-[#504E4F] pt-6">
//               Your Kundli report is generated using Vedic astrology principles,
//               which assign planets, houses, and dashas based on your birth time,
//               date, and place. Each planet influences your personality,
//               strengths, weaknesses, career, relationships, and more.
//             </p>
//             <p class="font-bold text-lg pt-4">Key Points in Your Report:</p>
//             <ul class="space-y-2 pt-2 pl-6 list-disc">
//               <li>
//                 <span class="font-bold">Ascendant (Lagna):</span> Rising sign at
//                 birth; represents self and physical appearance.
//               </li>
//               <li>
//                 <span class="font-bold">Planetary Positions:</span> Where
//                 planets are placed in signs and houses.
//               </li>
//               <li>
//                 <span class="font-bold">Panchang:</span> Tithi, Nakshatra, Yoga,
//                 Karan at birth.
//               </li>
//               <li>
//                 <span class="font-bold">Dashas:</span> Planetary periods like
//                 Vimshottari for timing events.
//               </li>
//               <li>
//                 <span class="font-bold">Charts:</span> Lagna, Navamsa, etc., for
//                 deeper insights.
//               </li>
//               <li>
//                 <span class="font-bold">KP System:</span> Precise timing using
//                 sub-lords.
//               </li>
//             </ul>
//             <div class="p-4 bg-[#e3af8a]/40 rounded-[10px] my-4">
//               <p>
//                 <span class="font-semibold">Note:</span> This report uses
//                 standard Vedic calculations. Consult a professional astrologer
//                 for personalized advice.
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//       <div
//         class="flex items-center justify-between px-6 absolute w-full left-0 bottom-0"
//       >
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//         <img src="${kalashImage}" class="w-[80px]" alt="" />
//       </div>
//     </section>
//   </body>
// </html>`;

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
