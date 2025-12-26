import { NextRequest, NextResponse } from 'next/server';

const NOAA_BASE_URL = 'https://www.ncdc.noaa.gov/cdo-web/api/v2';

interface NOAADataPoint {
  date: string;
  datatype: string;
  station: string;
  value: number;
}

interface StationCache {
  stationId: string;
  timestamp: number;
}

// Simple in-memory cache for station lookups
const stationCache = new Map<string, StationCache>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface Station {
  id: string;
  name: string;
  mindate: string;
  maxdate: string;
  datacoverage: number;
  latitude: number;
  longitude: number;
}

async function findNearbyStation(lat: string, lon: string, apiKey: string): Promise<string | null> {
  const cacheKey = `${lat},${lon}`;
  const cached = stationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.stationId;
  }

  // Search for stations within ~50km of the coordinates
  // NOAA extent format: minLat,minLon,maxLat,maxLon
  const extent = 0.5; // roughly 50km to find official stations
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const bbox = `${latNum - extent},${lonNum - extent},${latNum + extent},${lonNum + extent}`;

  const response = await fetch(
    `${NOAA_BASE_URL}/stations?datasetid=GHCND&extent=${bbox}&limit=1000`,
    {
      headers: { 'token': apiKey },
      next: { revalidate: 86400 }
    }
  );

  if (!response.ok) {
    console.error('Station search failed:', response.status);
    return null;
  }

  const data = await response.json();

  if (data.results && data.results.length > 0) {
    const stations = data.results as Station[];

    // Prioritize official stations (USW = Weather Service, USC = Cooperative)
    // These have better historical data than personal stations (US1*)
    const officialStations = stations.filter((s: Station) =>
      s.id.startsWith('GHCND:USW') || s.id.startsWith('GHCND:USC')
    );

    // Score stations: prefer official, high coverage, old mindate, recent maxdate
    const scoreStation = (s: Station): number => {
      let score = 0;
      // Official station bonus
      if (s.id.startsWith('GHCND:USW')) score += 1000;
      if (s.id.startsWith('GHCND:USC')) score += 500;
      // Data coverage (0-100 points)
      score += s.datacoverage * 100;
      // Years of history (up to 100 points for 100+ years)
      const minYear = new Date(s.mindate).getFullYear();
      const historyYears = 2025 - minYear;
      score += Math.min(historyYears, 100);
      // Recent data bonus
      if (s.maxdate >= '2024-01-01') score += 50;
      return score;
    };

    // Sort by score descending
    const sortedStations = stations.sort((a: Station, b: Station) =>
      scoreStation(b) - scoreStation(a)
    );

    const bestStation = sortedStations[0];
    console.log(`Selected station: ${bestStation.name} (${bestStation.id}) - data from ${bestStation.mindate} to ${bestStation.maxdate}`);

    stationCache.set(cacheKey, { stationId: bestStation.id, timestamp: Date.now() });
    return bestStation.id;
  }

  return null;
}

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5) + 32);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const month = searchParams.get('month');
  const day = searchParams.get('day');
  const yearsBack = parseInt(searchParams.get('years') || '20');

  if (!lat || !lon || !month || !day) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const apiKey = process.env.NOAA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'NOAA API key not configured' }, { status: 500 });
  }

  // Find a weather station near the coordinates
  const stationId = await findNearbyStation(lat, lon, apiKey);

  if (!stationId) {
    return NextResponse.json({ error: 'No weather station found near this location' }, { status: 404 });
  }

  const currentYear = new Date().getFullYear();
  const results: Array<{
    year: number;
    date: string;
    high: number | null;
    low: number | null;
    avg: number | null;
    precip: number | null;
    snow: number | null;
  }> = [];

  // NOAA API only allows date ranges < 1 year, so we need to fetch each year individually
  // But we can optimize by fetching a range around the target date
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');

  // Fetch data year by year (NOAA rate limits: 5 req/sec, 1000/day)
  for (let year = currentYear - 1; year >= currentYear - yearsBack; year--) {
    const targetDate = `${year}-${paddedMonth}-${paddedDay}`;

    try {
      // Fetch just that specific date's data
      const response = await fetch(
        `${NOAA_BASE_URL}/data?datasetid=GHCND&stationid=${stationId}&startdate=${targetDate}&enddate=${targetDate}&datatypeid=TMAX,TMIN,PRCP,SNOW&units=standard&limit=10`,
        {
          headers: { 'token': apiKey },
          next: { revalidate: 86400 }
        }
      );

      if (!response.ok) {
        // 400 often means no data for that date
        if (response.status !== 400) {
          console.error(`NOAA API error for ${targetDate}: ${response.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Parse the data for this date
        let tmax: number | null = null;
        let tmin: number | null = null;
        let prcp: number | null = null;
        let snow: number | null = null;

        for (const point of data.results as NOAADataPoint[]) {
          // NOAA with units=standard returns temperatures already in Fahrenheit
          // and precipitation in inches
          switch (point.datatype) {
            case 'TMAX':
              tmax = Math.round(point.value);
              break;
            case 'TMIN':
              tmin = Math.round(point.value);
              break;
            case 'PRCP':
              prcp = Math.round(point.value * 100) / 100; // Keep 2 decimal places
              break;
            case 'SNOW':
              snow = Math.round(point.value * 10) / 10; // Keep 1 decimal place
              break;
          }
        }

        // Calculate avg from min/max
        const avg = (tmax !== null && tmin !== null) ? Math.round((tmax + tmin) / 2) : null;

        results.push({
          year,
          date: targetDate,
          high: tmax,
          low: tmin,
          avg,
          precip: prcp,
          snow
        });
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`Error fetching ${targetDate}:`, error);
    }
  }

  // Sort by year descending
  results.sort((a, b) => b.year - a.year);

  // Calculate statistics
  const temps = results.filter(r => r.avg !== null).map(r => ({ year: r.year, temp: r.avg as number }));
  const highs = results.filter(r => r.high !== null).map(r => r.high as number);
  const lows = results.filter(r => r.low !== null).map(r => r.low as number);

  const stats = {
    avgHigh: highs.length > 0 ? Math.round(highs.reduce((a, b) => a + b, 0) / highs.length) : null,
    avgLow: lows.length > 0 ? Math.round(lows.reduce((a, b) => a + b, 0) / lows.length) : null,
    warmestYear: temps.length > 0 ? temps.reduce((a, b) => a.temp > b.temp ? a : b) : null,
    coldestYear: temps.length > 0 ? temps.reduce((a, b) => a.temp < b.temp ? a : b) : null,
    dataPoints: results.length,
    stationId // Include station ID for transparency
  };

  return NextResponse.json({ data: results, stats });
}
