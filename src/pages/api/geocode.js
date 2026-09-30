// Geocodes an address to lat/lng. Uses Google when GOOGLE_MAPS_API_KEY is set,
// otherwise (or if Google can't find it) OpenStreetMap's free Nominatim service.
import { requireSession } from "../../lib/session";

const geocodeWithGoogle = async (address, apiKey) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  );
  if (!response.ok) throw new Error(`Google geocoding failed: ${response.status}`);

  const data = await response.json();
  if (data.status === "OK" && data.results?.length) {
    const { lat, lng } = data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
  return null;
};

const geocodeWithNominatim = async (address) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`,
    { headers: { "User-Agent": "jogo-leads/1.0 (team lead tracker)" } }
  );
  if (!response.ok) throw new Error(`Nominatim failed: ${response.status}`);

  const results = await response.json();
  return results.length
    ? { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) }
    : null;
};

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = typeof req.body?.address === "string" ? req.body.address.trim().slice(0, 300) : "";
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    let result = null;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      try {
        result = await geocodeWithGoogle(address, apiKey);
      } catch (error) {
        console.error(error);
      }
    }

    if (!result) result = await geocodeWithNominatim(address);

    return result
      ? res.status(200).json(result)
      : res.status(404).json({ error: "Address not found" });
  } catch (error) {
    console.error("Geocoding error:", error);
    return res.status(500).json({ error: "Geocoding failed" });
  }
}
