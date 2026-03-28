const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const nodemailer = require("nodemailer");
const cors = require("cors"); // <-- 1. Import CORS here

const app = express();
app.use(cors()); // <-- 2. Use CORS right AFTER app is initialized
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// --- SECRETS & KEYS ---
const GEMINI_API_KEY = "AIzaSyAV7aRQ-awSoRor2n1w_E_LV2c7vS2rnzw";
const MAPS_API_KEY = "AIzaSyDkD0iyaPkulI8IosMnbhKQgBQ3PO29JkQ";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- EMAIL CONFIG (Update with real credentials) ---
const EMAIL_USER = process.env.EMAIL_USER || "smartripplanner@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "sdyl jbjt ywzl cjng";

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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ═══════════════════════════════════════════════════════
// 1. GENERATE ITINERARY (ENHANCED — Phase 2)
// ═══════════════════════════════════════════════════════
app.post("/generate", async (req, res) => {
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
// 2. AI CHATBOT ENDPOINT (Phase 4)
// ═══════════════════════════════════════════════════════
app.post("/chat", async (req, res) => {
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
// 3. CURRENCY CONVERTER (Free API, no key needed)
// ═══════════════════════════════════════════════════════
app.get("/currency", async (req, res) => {
    try {
        const response = await axios.get("https://api.exchangerate-api.com/v4/latest/INR");
        res.json({ rates: response.data.rates, base: "INR" });
    } catch (error) {
        // Fallback rates
        res.json({
            base: "INR",
            rates: { USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.78, AED: 0.044, SGD: 0.016, THB: 0.42, AUD: 0.018 }
        });
    }
});

// ═══════════════════════════════════════════════════════
// 4. NEARBY PLACES via Google Places API
// ═══════════════════════════════════════════════════════
app.get("/nearby-places", async (req, res) => {
    const { destination } = req.query;
    if (!destination) return res.json({ places: [] });

    try {
        // Geocode destination first
        const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${MAPS_API_KEY}`);
        const location = geoRes.data.results?.[0]?.geometry?.location;
        if (!location) return res.json({ places: [] });

        // Nearby tourist attractions
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
// 5. EMAIL ITINERARY (Phase 3)
// ═══════════════════════════════════════════════════════
app.post("/email-itinerary", async (req, res) => {
    const { email, destination, days, itinerarySummary } = req.body;
    if (!email || !destination) return res.status(400).json({ error: "Email and destination required." });

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        const mailOptions = {
            from: `TravelAI <${EMAIL_USER}>`,
            to: email,
            subject: `✈️ Your ${days}-Day ${destination} Itinerary — TravelAI`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f1a; color: #f5f0e8; padding: 32px; border-radius: 16px;">
                    <h1 style="color: #d4a76a; font-size: 28px; margin-bottom: 8px;">✈️ Your Trip to ${destination}</h1>
                    <p style="color: rgba(255,255,255,0.6); margin-bottom: 24px;">${days} Days | Generated by TravelAI</p>
                    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
                        <pre style="color: #f5f0e8; font-family: sans-serif; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${itinerarySummary}</pre>
                    </div>
                    <p style="margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.3);">Generated by TravelAI — Powered by Gemini AI. Always verify prices before booking.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (e) {
        console.error("Email error:", e.message);
        res.status(500).json({ error: "Email send failed. Check server email config." });
    }
});

// ═══════════════════════════════════════════════════════
// 6. IMAGE FETCHER (Original — unchanged)
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
// 7. GENERATE SMART PACKING LIST (Phase 4)
// ═══════════════════════════════════════════════════════
app.post("/packing-list", async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✈  TravelAI running on http://ai-travel-planner-gmmc.onrender.com:${PORT}`);
    console.log(`   New endpoints: /chat, /currency, /nearby-places, /email-itinerary, /packing-list`);
});