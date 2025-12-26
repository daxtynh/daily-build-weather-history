import { NextRequest, NextResponse } from 'next/server';

interface WeatherDay {
  date: string;
  tavg: number | null;
  tmin: number | null;
  tmax: number | null;
  prcp: number | null;
  snow: number | null;
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
  
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
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
  
  // Fetch data for each year going back
  // Meteostat returns metric (Celsius), we'll convert to Fahrenheit
  for (let year = currentYear - 1; year >= currentYear - yearsBack; year--) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    try {
      const response = await fetch(
        `https://meteostat.p.rapidapi.com/point/daily?lat=${lat}&lon=${lon}&start=${dateStr}&end=${dateStr}&units=imperial`,
        {
          headers: {
            'x-rapidapi-host': 'meteostat.p.rapidapi.com',
            'x-rapidapi-key': apiKey,
          },
          next: { revalidate: 86400 } // Cache for 1 day
        }
      );
      
      if (!response.ok) {
        console.error(`Meteostat error for ${dateStr}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const dayData: WeatherDay = data.data[0];
        results.push({
          year,
          date: dateStr,
          high: dayData.tmax,
          low: dayData.tmin,
          avg: dayData.tavg,
          precip: dayData.prcp,
          snow: dayData.snow
        });
      }
    } catch (error) {
      console.error(`Error fetching ${dateStr}:`, error);
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
    dataPoints: results.length
  };
  
  return NextResponse.json({ data: results, stats });
}
