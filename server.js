const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dns = require("dns");

// 🔴 FIX FOR RENDER EMAIL BUG: Force Node.js to use IPv4 to prevent ENETUNREACH errors
dns.setDefaultResultOrder('ipv4first');

const app = express();
const compression = require("compression");
app.use(compression());

app.use((req, res, next) => {
    res.setTimeout(120000);
    next();
});
// 1. Enable CORS for all routes
app.use(cors());

// 2. Parse incoming requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// 3. Health Check Route
app.get("/", (req, res) => {
    res.send("✈️ TravelAI Backend is Live, Secure, and Running!");
});

// ═══════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES & CONFIGURATION
// ═══════════════════════════════════════════════════════
// Pulling securely from Render's Environment Variables (NO HARDCODED KEYS!)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Startup check to ensure keys are loaded properly from Render Environment
if (!GEMINI_API_KEY) console.error("⚠️ WARNING: GEMINI_API_KEY is missing from environment variables.");
if (!MAPS_API_KEY) console.error("⚠️ WARNING: MAPS_API_KEY is missing from environment variables.");
if (!EMAIL_USER || !EMAIL_PASS) console.error("⚠️ WARNING: EMAIL_USER or EMAIL_PASS is missing.");

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// --- IATA CODE MAPPER ---
const getIATACode = (city) => {
    const map = {
        "mumbai": "BOM", "delhi": "DEL", "bangalore": "BLR", "bengaluru": "BLR",
        "chennai": "MAA", "kolkata": "CCU", "hyderabad": "HYD", "pune": "PNQ",
        "ahmedabad": "AMD", "jaipur": "JAI", "kochi": "COK", "goa": "GOI",
        "bangkok": "BKK", "phuket": "HKT", "dubai": "DXB", "singapore": "SIN",
        "amsterdam": "AMS", "paris": "CDG", "london": "LHR", "tokyo": "NRT",
        "new york": "JFK", "bali": "DPS", "kuala lumpur": "KUL",
        "hong kong": "HKG", "sydney": "SYD", "rome": "FCO", "barcelona": "BCN",
        "istanbul": "IST", "maldives": "MLE", "sri lanka": "CMB"
    };
    return map[city.toLowerCase().trim()] || city.substring(0, 3).toUpperCase();
};

// ═══════════════════════════════════════════════════════
// 1. GENERATE ITINERARY 
// ═══════════════════════════════════════════════════════
app.post("/generate", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key is not configured." });

    const { from, destination, budget, days, date, style, travelers, pace, interests } = req.body;

    const travelStyle = style === "luxury" ? "luxury 5-star" : style === "mid" ? "mid-range comfortable" : style === "adventure" ? "adventure-focused" : style === "relax" ? "relaxing & leisurely" : "budget-friendly";
    const travelPace = pace === "slow" ? "slow (max 2-3 places per day, long relaxed stays)" : pace === "fast" ? "fast (5-6 places per day, packed schedule)" : "normal (3-4 places per day, balanced)";
    const interestsList = interests ? interests.split(',').join(', ') : "general sightseeing";
    const parsedDays = parseInt(days) || 3;

    const prompt = `
You are an elite AI travel planner API. Create a hyper-personalized travel itinerary.

TRIP DETAILS:
- From: ${from} → Destination: ${destination}
- Travelers: ${travelers} | Style: ${travelStyle} | Pace: ${travelPace}
- Interests: ${interestsList} | Budget: ₹${budget} for ${parsedDays} days | Date: ${date}

CRITICAL RULES:
1. Output EXACTLY ${parsedDays} day objects in "itinerary" array.
2. Tailor places based on interests: if beach → beach spots, if history → monuments, if food → food streets, if adventure → sports/hikes, if nightlife → clubs/bars, if shopping → markets/malls.
3. Budget style → budget accommodations, public transport, street food, free attractions.
4. Luxury style → 5-star hotels, fine dining, private transfers, premium experiences.
5. Adventure style → trekking, adventure sports, offbeat locations.
6. Slow pace → fewer places, more depth. Fast pace → more places, quick stops.
7. All hotel names, prices, flight names MUST be realistic for ${destination}.

Return ONLY this JSON (no markdown, no extra text):
{
  "flights": [
    {
      "airline": "Real Airline Name",
      "code": "FL-123",
      "price": "₹12500",
      "outbound": {"time": "10:00 AM → 12:30 PM", "duration": "2h 30m", "stops": "Non-stop"},
      "inbound": {"time": "02:00 PM → 04:30 PM", "duration": "2h 30m", "stops": "Non-stop"}
    }
  ],
  "hotels": [
    {"name": "Real Hotel Name in ${destination}", "rating": "4.5★", "price": "₹4500/night", "address": "Real Area, ${destination}"}
  ],
  "itinerary": [
    {
      "day": 1,
      "theme": "Arrival & Exploration",
      "places": ["Exact Famous Place 1", "Exact Famous Place 2", "Exact Famous Place 3"],
      "imageSearchQueries": ["Exact Famous Place 1 ${destination}", "Exact Famous Place 2 ${destination}"],
      "food": "Restaurant Name — Dish (e.g. Café De Sol — Fish Curry ₹350)",
      "transport": "Mode — e.g. Taxi ₹500 or Metro ₹50",
      "cost": "₹2000",
      "note": "Practical tip for this day"
    }
  ],
  "budget_breakdown": {
    "flights": "₹8000",
    "hotels": "₹12000",
    "food": "₹3000",
    "transport": "₹1500",
    "activities": "₹500",
    "budget_total": "₹15000",
    "midrange_total": "₹30000",
    "luxury_total": "₹65000"
  },
  "best_time": {
    "best_months": "October to March",
    "weather_summary": "Pleasant, 20-28°C, low humidity",
    "peak_season": "December - January (crowds & prices high)",
    "off_season": "June - August (monsoon, cheaper deals)",
    "cheapest_months": "July - August"
  },
  "visa_info": {
    "required": true,
    "type": "Tourist Visa (e-Visa available)",
    "processing_time": "3-5 business days",
    "cost_approx": "₹5000 (~$60 USD)",
    "validity": "30 days single entry",
    "website": "https://evisa.gov.example.com",
    "notes": "Apply at least 2 weeks before travel"
  },
  "nearby_places": [
    {"name": "Nearby City/Place 1", "distance": "45 km", "type": "Beach / Hill / City"},
    {"name": "Nearby City/Place 2", "distance": "80 km", "type": "Historical Site"},
    {"name": "Nearby City/Place 3", "distance": "120 km", "type": "Nature Reserve"}
  ],
  "packing_list": {
    "documents": ["Passport", "Visa Copy", "Hotel Confirmations", "Travel Insurance", "Flight Tickets"],
    "clothes": ["Light summer clothes", "Comfortable walking shoes", "Rain jacket"],
    "essentials": ["Sunscreen SPF 50", "Insect repellent", "Basic medicines", "Hand sanitizer"],
    "tech": ["Universal adapter", "Power bank", "Camera", "Earphones"],
    "local_tips": ["Download offline maps", "Keep local currency", "Save hotel address in local language"]
  },
  "totalEstimatedCost": "₹25000"
}`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(text);
        data.meta = { originCode: getIATACode(from), destCode: getIATACode(destination) };
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data));
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Error generating itinerary." });
    }
});

// ═══════════════════════════════════════════════════════
// 2. AI CHATBOT ENDPOINT
// ═══════════════════════════════════════════════════════
app.post("/chat", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key is not configured." });
    
    const { message, destination, context } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chatPrompt = `You are TravelAI, a friendly and knowledgeable AI travel assistant specializing in travel to ${destination || 'various destinations'}. 
        
Context: ${context || 'User is planning a trip.'}

Answer this travel question concisely and helpfully (max 3-4 sentences). Use emojis sparingly.
Question: ${message}`;

        const result = await model.generateContent(chatPrompt);
        const reply = result.response.text().trim();
        res.json({ reply });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "Chat unavailable." });
    }
});

// ═══════════════════════════════════════════════════════
// 3. CURRENCY CONVERTER
// ═══════════════════════════════════════════════════════
app.get("/currency", async (req, res) => {
    try {
        const response = await axios.get("https://api.exchangerate-api.com/v4/latest/INR");
        res.json({ rates: response.data.rates, base: "INR" });
    } catch (error) {
        res.json({
            base: "INR",
            rates: { USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.78, AED: 0.044, SGD: 0.016, THB: 0.42, AUD: 0.018 }
        });
    }
});

// ═══════════════════════════════════════════════════════
// 4. NEARBY PLACES 
// ═══════════════════════════════════════════════════════
app.get("/nearby-places", async (req, res) => {
    const { destination } = req.query;
    if (!destination) return res.json({ places: [] });
    if (!MAPS_API_KEY) return res.json({ places: [] });

    try {
        const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${MAPS_API_KEY}`);
        const location = geoRes.data.results?.[0]?.geometry?.location;
        if (!location) return res.json({ places: [] });

        const placesRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=15000&type=tourist_attraction&key=${MAPS_API_KEY}`
        );
        const places = (placesRes.data.results || []).slice(0, 6).map(p => ({
            name: p.name,
            rating: p.rating,
            vicinity: p.vicinity,
            types: p.types?.slice(0, 2).join(', ')
        }));
        res.json({ places });
    } catch (e) {
        console.error("Nearby places error:", e.message);
        res.json({ places: [] });
    }
});

// ═══════════════════════════════════════════════════════
// 5. EMAIL ITINERARY (Real SaaS API via Brevo)
// ═══════════════════════════════════════════════════════
app.post("/email-itinerary", async (req, res) => {
    const { email, destination, days, from, style, budget, travelDate, itinerary, totalCost } = req.body;
    
    if (!email || !destination) return res.status(400).json({ error: "Email and destination required." });
    
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const EMAIL_USER = process.env.EMAIL_USER;

    if (!BREVO_API_KEY || !EMAIL_USER) {
        return res.status(500).json({ error: "Server email API is not configured." });
    }

    // Format style label
    const tripStyle = style ? style.charAt(0).toUpperCase() + style.slice(1) : 'Standard';
    const estCost = totalCost || (budget ? '₹' + parseInt(budget).toLocaleString('en-IN') : '—');

    // Build day cards HTML
    const dayCardsHtml = (itinerary || []).map(day => `
      <tr>
        <td style="padding: 6px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="background-color:#1a2235; border:1px solid rgba(212,167,106,0.15); border-radius:12px; overflow:hidden; margin-bottom:4px;">
            <!-- Day header -->
            <tr>
              <td style="padding:14px 20px; background:rgba(212,167,106,0.08); border-bottom:1px solid rgba(212,167,106,0.15);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <span style="font-family:Georgia,'Times New Roman',serif; font-size:17px; color:#d4a76a; font-weight:600;">Day ${day.day}</span>
                      ${day.theme ? `<span style="font-size:12px; color:rgba(212,167,106,0.65); margin-left:10px;">— ${day.theme}</span>` : ''}
                    </td>
                    <td align="right">
                      <span style="font-size:13px; color:#d4a76a; font-weight:600;">${day.cost || ''}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Places row -->
            <tr>
              <td style="padding:12px 20px 8px;">
                <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(245,240,232,0.35); margin-bottom:8px;">📍 Places to Visit</div>
                <div>${(day.places || []).map(p => `<span style="display:inline-block; background:rgba(212,167,106,0.1); border:1px solid rgba(212,167,106,0.22); color:#d4a76a; padding:3px 11px; border-radius:20px; font-size:12px; margin:2px 3px 2px 0;">${p}</span>`).join('')}</div>
              </td>
            </tr>
            <!-- Food & Transport -->
            <tr>
              <td style="padding:8px 20px 14px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" valign="top" style="padding-right:8px;">
                      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:11px 13px;">
                        <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:rgba(245,240,232,0.38); margin-bottom:5px;">🍴 Food</div>
                        <div style="font-size:13px; color:#f5f0e8; line-height:1.55;">${day.food || '—'}</div>
                      </div>
                    </td>
                    <td width="50%" valign="top" style="padding-left:8px;">
                      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:11px 13px;">
                        <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:rgba(245,240,232,0.38); margin-bottom:5px;">🚕 Transport</div>
                        <div style="font-size:13px; color:#f5f0e8; line-height:1.55;">${day.transport || '—'}</div>
                      </div>
                    </td>
                  </tr>
                </table>
                ${day.note ? `<div style="margin-top:8px; background:rgba(212,167,106,0.06); border:1px solid rgba(212,167,106,0.15); border-radius:8px; padding:9px 13px; font-size:12px; color:rgba(245,240,232,0.7); line-height:1.5;">💡 <strong style="color:#d4a76a;">Pro Tip:</strong> ${day.note}</div>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('');

    // Full email HTML
    const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your TravelAI Itinerary</title>
</head>
<body style="margin:0; padding:0; background-color:#0d1117; font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d1117;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px; width:100%; background-color:#0a0f1a; border-radius:16px; overflow:hidden; border:1px solid rgba(212,167,106,0.15);">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0f1a 0%,#1a2235 100%); padding:36px 40px 28px; text-align:center; border-bottom:1px solid rgba(212,167,106,0.18);">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:13px; letter-spacing:0.22em; text-transform:uppercase; color:#d4a76a; margin-bottom:14px;">✈ TravelAI</div>
              <h1 style="font-family:Georgia,'Times New Roman',serif; color:#f5f0e8; font-size:30px; font-weight:300; margin:0 0 10px; line-height:1.2;">Your Trip to ${destination}</h1>
              <p style="color:rgba(245,240,232,0.48); font-size:13px; margin:0;">${days} Days &nbsp;·&nbsp; ${from || 'Home'} → ${destination} &nbsp;·&nbsp; ${tripStyle} Style</p>
            </td>
          </tr>

          <!-- ── SUMMARY STRIP ── -->
          <tr>
            <td style="background:#111827; padding:20px 32px; border-bottom:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" width="25%" style="padding:0 6px;">
                    <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(245,240,232,0.36); margin-bottom:5px;">Duration</div>
                    <div style="font-size:15px; font-weight:700; color:#d4a76a;">${days} Days</div>
                  </td>
                  <td align="center" width="25%" style="padding:0 6px; border-left:1px solid rgba(255,255,255,0.07);">
                    <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(245,240,232,0.36); margin-bottom:5px;">From</div>
                    <div style="font-size:15px; font-weight:700; color:#d4a76a;">${from || '—'}</div>
                  </td>
                  <td align="center" width="25%" style="padding:0 6px; border-left:1px solid rgba(255,255,255,0.07);">
                    <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(245,240,232,0.36); margin-bottom:5px;">Style</div>
                    <div style="font-size:15px; font-weight:700; color:#d4a76a;">${tripStyle}</div>
                  </td>
                  <td align="center" width="25%" style="padding:0 6px; border-left:1px solid rgba(255,255,255,0.07);">
                    <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(245,240,232,0.36); margin-bottom:5px;">Est. Budget</div>
                    <div style="font-size:15px; font-weight:700; color:#d4a76a;">${estCost}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── ITINERARY HEADING ── -->
          <tr>
            <td style="padding:28px 32px 10px;">
              <h2 style="font-family:Georgia,'Times New Roman',serif; font-size:20px; font-weight:400; color:#f5f0e8; margin:0 0 4px;">🗓 Day-by-Day Itinerary</h2>
              <p style="font-size:11px; color:rgba(245,240,232,0.38); margin:0;">Curated by Gemini AI based on your preferences</p>
            </td>
          </tr>

          <!-- ── DAY CARDS ── -->
          ${dayCardsHtml}

          <!-- ── DIVIDER ── -->
          <tr><td style="padding:4px 0;"></td></tr>

          <!-- ── CTA ── -->
          <tr>
            <td style="padding:28px 40px 24px; text-align:center; border-top:1px solid rgba(255,255,255,0.06);">
              <p style="color:rgba(245,240,232,0.5); font-size:14px; margin:0 0 18px; line-height:1.6;">Want to explore more destinations or tweak this plan?</p>
              <a href="https://amazing-travel-123.netlify.app/"
                style="display:inline-block; background:linear-gradient(135deg,#d4a76a,#c8941a); color:#0a0f1a; text-decoration:none; padding:13px 30px; border-radius:50px; font-size:13px; font-weight:700; letter-spacing:0.06em;">✨ Plan Another Trip</a>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:18px 40px 22px; background:#050a12; text-align:center;">
              <p style="color:rgba(245,240,232,0.22); font-size:11px; margin:0; line-height:1.7;">
                Generated by <strong style="color:rgba(212,167,106,0.5);">TravelAI</strong> — Powered by Gemini AI<br>
                Flight &amp; hotel prices are estimates only. Always verify before booking.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
        // Send email via Brevo REST API (Bypasses Render's SMTP Port Block)
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { email: EMAIL_USER, name: "TravelAI Planner" },
            to: [{ email: email }],
            subject: `✈️ Your ${days}-Day ${destination} Itinerary — TravelAI`,
            htmlContent
        }, {
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            }
        });

        res.json({ success: true });
    } catch (e) {
        console.error("Brevo Email error:", e.response ? e.response.data : e.message);
        res.status(500).json({ error: "Email send failed via API." });
    }
});

// ═══════════════════════════════════════════════════════
// 6. IMAGE FETCHER
// ═══════════════════════════════════════════════════════
app.get("/get-image", async (req, res) => {
    try {
        const { query, type } = req.query;
        const cleanQuery = query.replace(/[^a-zA-Z0-9 ]/g, "").trim();

        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=1`;
        const wikiRes = await axios.get(wikiUrl, {
            headers: { 'User-Agent': 'TravelAI_App/1.0 (learning_project_do_not_block)' }
        });

        const pages = wikiRes.data.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pages[pageId].thumbnail?.source) {
                const imgSrc = pages[pageId].thumbnail.source;
                if (!imgSrc.toLowerCase().endsWith('.svg') && !imgSrc.toLowerCase().includes('map')) {
                    return res.json({ imageUrl: imgSrc });
                }
            }
        }

        const flickrKeywords = cleanQuery.split(" ").slice(0, 3).join(",");
        const fallbackKeyword = type === 'hotel' ? `hotel,resort,${flickrKeywords}` : flickrKeywords;
        res.json({ imageUrl: `https://loremflickr.com/800/600/${encodeURIComponent(fallbackKeyword)}/all` });

    } catch (error) {
        console.error("Image Fetch Error:", error.message);
        res.json({ imageUrl: `https://placehold.co/800x600/1a2235/d4a76a?text=${encodeURIComponent(req.query.query.split(' ')[0])}` });
    }
});

// ═══════════════════════════════════════════════════════
// 7. GENERATE SMART PACKING LIST
// ═══════════════════════════════════════════════════════
app.post("/packing-list", async (req, res) => {
    if (!genAI) return res.status(500).json({ error: "Gemini API key is not configured." });

    const { destination, days, style, date } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Generate a smart packing list for a ${days}-day ${style} trip to ${destination} on ${date}. 
Consider the weather, culture, and activities. Return ONLY JSON:
{
  "documents": ["item1", "item2"],
  "clothes": ["item1", "item2"],
  "essentials": ["item1", "item2"],
  "tech": ["item1"],
  "money": ["item1"],
  "local_tips": ["tip1", "tip2"]
}`;
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: "Could not generate packing list." });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✈  TravelAI Backend running on Port ${PORT}`);
});