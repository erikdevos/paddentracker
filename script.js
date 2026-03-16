console.log("Paddentrek app gestart");

/* -----------------------------
LOCAL STORAGE
----------------------------- */

function saveLocation(place, lat, lon) {

    const data = {
        place,
        lat,
        lon
    };

    localStorage.setItem("paddentrek_location", JSON.stringify(data));

}

function loadSavedLocation() {

    const raw = localStorage.getItem("paddentrek_location");

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }

}


/* -----------------------------
VISUELE DOTS
----------------------------- */

function setDot(id, status) {

    const el = document.getElementById(id);

    if (!el) return;

    el.classList.remove("good", "ok", "bad");

    if (status === "good") el.classList.add("good");
    if (status === "ok") el.classList.add("ok");
    if (status === "bad") el.classList.add("bad");

}


/* -----------------------------
WEER API
----------------------------- */

async function getWeather(lat, lon) {

    const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
        "&longitude=" + lon +
        "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_1cm" +
        "&daily=sunset,temperature_2m_min" +
        "&timezone=auto";

    const res = await fetch(url);

    return await res.json();

}


/* -----------------------------
WEATHER HELPERS
----------------------------- */

function findClosestHourIndex(times, target) {

    let best = 0;
    let diff = Infinity;

    for (let i = 0; i < times.length; i++) {

        const d = Math.abs(new Date(times[i]) - target);

        if (d < diff) {
            diff = d;
            best = i;
        }

    }

    return best;

}


function getEveningWeather(weather) {

    const sunset = new Date(weather.daily.sunset[0]);

    const target = new Date(sunset.getTime() + 3600000);

    const idx = findClosestHourIndex(weather.hourly.time, target);

    return {

        index: idx,
        temp: weather.hourly.temperature_2m[idx],
        feels: weather.hourly.apparent_temperature[idx],
        humidity: weather.hourly.relative_humidity_2m[idx],
        rain: weather.hourly.precipitation[idx],
        wind: weather.hourly.wind_speed_10m[idx],
        soilTemp: weather.hourly.soil_temperature_0cm[idx],
        soilMoisture: weather.hourly.soil_moisture_0_1cm[idx]

    };

}


function getTemperatureTrend(weather, index) {

    const temps = weather.hourly.temperature_2m;

    if (index === 0) return 0;

    return temps[index] - temps[index - 1];

}


function getRecentRain(weather, index) {

    let total = 0;

    for (let i = index - 3; i < index; i++) {

        if (i >= 0) total += weather.hourly.precipitation[i];

    }

    return total;

}


/* -----------------------------
NORMALIZERS
----------------------------- */

function normalizeTemp(t) {

    if (t < 4) return 0;
    if (t < 6) return 0.3;
    if (t < 8) return 0.6;
    if (t <= 12) return 1;
    if (t <= 15) return 0.7;

    return 0.4;

}

function normalizeHumidity(h) {

    if (h < 50) return 0.1;
    if (h < 65) return 0.4;
    if (h < 80) return 0.8;

    return 1;

}

function normalizeRain(r) {

    if (r === 0) return 0.2;
    if (r < 0.5) return 0.6;
    if (r < 2) return 1;

    return 0.7;

}

function normalizeSoilTemp(t) {
    if (t < 5) return 0;
    if (t < 7) return 0.3;
    if (t < 9) return 0.6;
    if (t <= 13) return 1;
    if (t <= 16) return 0.7;

    return 0.4;
}

function normalizeSoilMoisture(m) {
    if (m < 0.2) return 0.2;
    if (m < 0.3) return 0.4;
    if (m < 0.5) return 0.8;
    if (m < 0.7) return 1;

    return 0.9;
}

function normalizeWind(w) {

    if (w > 35) return 0;
    if (w > 25) return 0.2;
    if (w > 15) return 0.5;

    return 1;

}

function normalizeTrend(t) {

    if (t > 1) return 1;
    if (t > 0) return 0.7;
    if (t > -1) return 0.4;

    return 0.2;

}

function normalizeRecentRain(r) {

    if (r > 1) return 1;
    if (r > 0.3) return 0.7;
    if (r > 0) return 0.4;

    return 0.2;

}


/* -----------------------------
PADDETREK SCORE
----------------------------- */

function paddentrekScore(weather, evening) {

    const nightMin = weather.daily.temperature_2m_min[0];

    if (evening.feels < 4) return 0;
    if (nightMin <= 0) return 0;
    if (evening.wind > 35) return 0;

    const trend = getTemperatureTrend(weather, evening.index);
    const recentRain = getRecentRain(weather, evening.index);

    let score = 0;

    score += normalizeTemp(evening.feels) * 25;
    score += normalizeHumidity(evening.humidity) * 15;
    score += normalizeRain(evening.rain) * 10;
    score += normalizeTrend(trend) * 8;
    score += normalizeWind(evening.wind) * 8;
    score += normalizeRecentRain(recentRain) * 8;
    score += normalizeSoilTemp(evening.soilTemp) * 16;
    score += normalizeSoilMoisture(evening.soilMoisture) * 10;

    return Math.round(score);

}


/* -----------------------------
TIJDEN
----------------------------- */

function trekTime(sunset) {

    const s = new Date(sunset);

    const start = new Date(s.getTime() + 1800000);
    const peak = new Date(s.getTime() + 5400000);

    return {

        start: start.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        }),
        peak: peak.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })

    };

}


/* -----------------------------
FORECAST KLEUR
----------------------------- */

function forecastClass(score) {

    if (score >= 70) return "forecast-good";
    if (score >= 40) return "forecast-ok";

    return "forecast-bad";

}


/* -----------------------------
NOTIFICATIONS
----------------------------- */

async function requestNotificationPermission() {

    if (!("Notification" in window)) return false;

    if (Notification.permission === "granted") return true;

    if (Notification.permission !== "denied") {

        const p = await Notification.requestPermission();

        return p === "granted";

    }

    return false;

}


function notificationSentToday() {

    const today = new Date().toISOString().split("T")[0];

    return localStorage.getItem("paddentrek_notify") === today;

}

function markNotificationSent() {

    const today = new Date().toISOString().split("T")[0];

    localStorage.setItem("paddentrek_notify", today);

}


function showNotification(score) {

    let body = "Mogelijk paddentrek vanavond.";

    if (score >= 70) body = "Grote kans op paddentrek vanavond.";

    new Notification("Paddentrek verwachting", {
        body
    });

}


async function scheduleNotification(score, sunset) {

    if (score < 40) return;

    if (notificationSentToday()) return;

    const allowed = await requestNotificationPermission();

    if (!allowed) return;

    const sunsetTime = new Date(sunset);

    const notifyTime = new Date(sunsetTime.getTime() - 600000);

    const delay = notifyTime - new Date();

    if (delay <= 0) return;

    setTimeout(() => {

        showNotification(score);

        markNotificationSent();

    }, delay);

}


/* -----------------------------
FORECAST
----------------------------- */

function calculateDayScore(weather, day) {

    const sunset = new Date(weather.daily.sunset[day]);

    const target = new Date(sunset.getTime() + 3600000);

    const idx = findClosestHourIndex(weather.hourly.time, target);

    const evening = {

        index: idx,
        temp: weather.hourly.temperature_2m[idx],
        feels: weather.hourly.apparent_temperature[idx],
        humidity: weather.hourly.relative_humidity_2m[idx],
        rain: weather.hourly.precipitation[idx],
        wind: weather.hourly.wind_speed_10m[idx],
        soilTemp: weather.hourly.soil_temperature_0cm[idx],
        soilMoisture: weather.hourly.soil_moisture_0_1cm[idx]

    };

    return paddentrekScore(weather, evening);

}


function getDayName(date) {

    return new Date(date).toLocaleDateString("nl-NL", {
        weekday: "long"
    });

}


function renderForecast(weather) {

    const container = document.getElementById("forecastList");

    if (!container) return;

    container.innerHTML = "";

    for (let i = 0; i < 5; i++) {

        const score = calculateDayScore(weather, i);

        const row = document.createElement("div");

        row.className = "forecastRow " + forecastClass(score);

        row.innerHTML =
            "<span>" + getDayName(weather.daily.time[i]) + "</span>" +
            "<span>" + score + "%</span>";

        container.appendChild(row);

    }

}


/* -----------------------------
UI UPDATE
----------------------------- */

function updateUI(weather, place) {

    const evening = getEveningWeather(weather);

    const sunset = weather.daily.sunset[0];

    document.getElementById("temp").textContent = evening.temp + "°C";
    document.getElementById("feels").textContent = evening.feels + "°C";
    document.getElementById("humidity").textContent = evening.humidity + "%";
    document.getElementById("rain").textContent = evening.rain + " mm";
    document.getElementById("soilTemp").textContent = evening.soilTemp + "°C";
    document.getElementById("soilMoisture").textContent = Math.round(evening.soilMoisture * 100) + "%";

    document.getElementById("sunset").textContent =
        new Date(sunset).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    setDot("tempDot", evening.temp >= 7 && evening.temp <= 12 ? "good" : "ok");
    setDot("feelsDot", evening.feels >= 8 ? "good" : "ok");
    setDot("humidityDot", evening.humidity >= 80 ? "good" : "ok");
    setDot("rainDot", evening.rain > 0 ? "good" : "ok");
    setDot("soilTempDot", evening.soilTemp >= 9 && evening.soilTemp <= 13 ? "good" : "ok");
    setDot("soilMoistureDot", evening.soilMoisture >= 0.3 && evening.soilMoisture <= 0.7 ? "good" : "ok");

    const score = paddentrekScore(weather, evening);

    const time = trekTime(sunset);

    document.getElementById("score").textContent = score === 0 ? "vandaag geen kans" : "vandaag " + score + "% kans";

    const trekTimeElement = document.getElementById("trekTime");
    if (score === 0) {
        trekTimeElement.textContent = "";
    } else {
        trekTimeElement.textContent =
            "Start rond " + time.start + " (piek " + time.peak + ")";
    }

    document.getElementById("status").textContent =
        "Live weerdata voor " + place;

    scheduleNotification(score, sunset);

    renderForecast(weather);

}


/* -----------------------------
WEER LADEN (FIX)
----------------------------- */

async function loadWeather(lat, lon, place) {

    document.getElementById("status").textContent = "Weerdata ophalen...";

    try {

        const weather = await getWeather(lat, lon);

        updateUI(weather, place);

    } catch (err) {

        console.error("Weer ophalen mislukt", err);

        document.getElementById("status").textContent = "Weerdata ophalen mislukt";

    }

}


/* -----------------------------
LOCATIE
----------------------------- */

async function reverseGeocode(lat, lon) {

    const url = "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json";

    const res = await fetch(url);

    const data = await res.json();

    if (!data.address) return "Onbekende locatie";

    return (
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.municipality ||
        data.address.county ||
        "Onbekende locatie"
    );

}

function getMyLocation() {

    document.getElementById("status").textContent = "Locatie ophalen...";

    navigator.geolocation.getCurrentPosition(

        async function(pos) {

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            const place = await reverseGeocode(lat, lon);

            document.getElementById("placeInput").value = place;

            saveLocation(place, lat, lon);

            loadWeather(lat, lon, place);

        }

    );

}


/* -----------------------------
SEARCH
----------------------------- */

async function geocode(place) {

    const url = "https://geocoding-api.open-meteo.com/v1/search?name=" + place + "&count=1&language=nl&format=json";

    const res = await fetch(url);

    const data = await res.json();

    if (!data.results) throw new Error("Plaats niet gevonden");

    return data.results[0];

}


document.getElementById("searchBtn").onclick = async function() {

    const place = document.getElementById("placeInput").value;

    if (!place) return;

    const geo = await geocode(place);

    document.getElementById("placeInput").value = geo.name;

    saveLocation(geo.name, geo.latitude, geo.longitude);

    loadWeather(geo.latitude, geo.longitude, geo.name);

};


document.getElementById("geoBtn").onclick = getMyLocation;


/* -----------------------------
INIT
----------------------------- */

window.onload = function() {

    const saved = loadSavedLocation();

    if (saved) {

        document.getElementById("placeInput").value = saved.place;

        loadWeather(saved.lat, saved.lon, saved.place);

    } else {

        getMyLocation();

    }

};