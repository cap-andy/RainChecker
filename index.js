import "dotenv/config";
import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.OWM_API_KEY;

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/api/forecast", async (req, res) => {
  const { postcode } = req.query;

  if (!postcode || !/^\d{4}$/.test(postcode)) {
    return res.status(400).json({ error: "Invalid postcode. Please provide a valid 4-digit postcode." });
  }

  try {
    const geoRes = await axios.get(
      `https://api.openweathermap.org/geo/1.0/zip?zip=${postcode},AU&appid=${API_KEY}`
    );
    const { lat, lon, name } = geoRes.data;

    const forecastRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );

    const { list, city } = forecastRes.data;
    const offset = city.timezone; // seconds offset from UTC for this location

    // Shift a UTC timestamp by the city's offset, then read off the date —
    // gives us "tomorrow" in the forecast location's local calendar day,
    // not the server's.
    const toLocalDate = (unixSeconds) =>
      new Date((unixSeconds + offset) * 1000).toISOString().slice(0, 10);

    const todayLocal = toLocalDate(Math.floor(Date.now() / 1000));
    const tomorrowDate = new Date(`${todayLocal}T00:00:00Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrowLocal = tomorrowDate.toISOString().slice(0, 10);

    // This endpoint returns one entry per 3-hour slot — grab every slot
    // that falls on tomorrow's date.
    const tomorrowEntries = list.filter((entry) => toLocalDate(entry.dt) === tomorrowLocal);

    if (tomorrowEntries.length === 0) {
      return res.status(404).json({ error: "We don't have tomorrow's forecast yet. Try again later." });
    }

    const rainiest = tomorrowEntries.reduce((max, e) => (e.pop > max.pop ? e : max), tomorrowEntries[0]);

    res.json({
      city: name,
      probability: Math.round(rainiest.pop * 100),
      tempHigh: Math.round(Math.max(...tomorrowEntries.map((e) => e.main.temp_max))),
      tempLow: Math.round(Math.min(...tomorrowEntries.map((e) => e.main.temp_min))),
      wind: Math.round(Math.max(...tomorrowEntries.map((e) => e.wind.speed))),
      condition: rainiest.weather[0].main
    });
  } catch (error) {
    console.error("Failed to fetch weather data:", error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({ error: "We couldn't find that postcode." });
    }

    res.status(500).json({ error: "Failed to fetch weather data. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});