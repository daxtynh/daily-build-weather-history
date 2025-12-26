import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL!);

interface WeatherRow {
  year: number;
  date: string;
  tmax: number | null;
  tmin: number | null;
  prcp: number | null;
  snow: number | null;
}

interface StationRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - yearsBack;

    // Find nearest station with data for this month/day
    const stations = await sql`
      SELECT
        s.id,
        s.name,
        s.latitude,
        s.longitude,
        SQRT(POW(s.latitude - ${latNum}, 2) + POW(s.longitude - ${lonNum}, 2)) as distance
      FROM stations s
      WHERE s.max_date >= ${`${currentYear - 1}-01-01`}
        AND EXISTS (
          SELECT 1 FROM weather_daily w
          WHERE w.station_id = s.id
            AND w.month = ${monthNum}
            AND w.day = ${dayNum}
          LIMIT 1
        )
      ORDER BY distance
      LIMIT 1
    ` as StationRow[];

    if (stations.length === 0) {
      return NextResponse.json({ error: 'No weather station found near this location' }, { status: 404 });
    }

    const station = stations[0];

    // Get weather data for this station, month, and day across all years
    const weatherData = await sql`
      SELECT
        EXTRACT(YEAR FROM date)::int as year,
        date::text,
        tmax,
        tmin,
        prcp,
        snow
      FROM weather_daily
      WHERE station_id = ${station.id}
        AND month = ${monthNum}
        AND day = ${dayNum}
        AND EXTRACT(YEAR FROM date) >= ${minYear}
      ORDER BY date DESC
    ` as WeatherRow[];

    // Format results
    const results = weatherData.map(row => ({
      year: row.year,
      date: row.date,
      high: row.tmax !== null ? Math.round(row.tmax / 10) : null,  // Convert from tenths
      low: row.tmin !== null ? Math.round(row.tmin / 10) : null,
      avg: (row.tmax !== null && row.tmin !== null)
        ? Math.round((row.tmax + row.tmin) / 20)
        : null,
      precip: row.prcp !== null ? Math.round(row.prcp) / 100 : null,  // Convert from hundredths
      snow: row.snow !== null ? Math.round(row.snow) / 10 : null  // Convert from tenths
    }));

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
      stationId: station.id,
      stationName: station.name
    };

    return NextResponse.json({ data: results, stats });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
  }
}
