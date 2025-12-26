'use client';

import { useState, useEffect } from 'react';
import { formatDate, calculateTrend } from '@/lib/utils';

interface WeatherResult {
  year: number;
  date: string;
  high: number | null;
  low: number | null;
  avg: number | null;
  precip: number | null;
  snow: number | null;
}

interface Stats {
  avgHigh: number | null;
  avgLow: number | null;
  warmestYear: { year: number; temp: number } | null;
  coldestYear: { year: number; temp: number } | null;
  dataPoints: number;
  stationId?: string;
  stationName?: string;
}

interface GeoData {
  lat: number;
  lon: number;
  city: string;
  state: string;
  display: string;
}

export default function WeatherClient({
  zip,
  month,
  day,
}: {
  zip: string;
  month: string;
  day: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WeatherResult[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [location, setLocation] = useState<GeoData | null>(null);
  const [copied, setCopied] = useState(false);
  const yearsBack = 20;

  useEffect(() => {
    async function fetchData() {
      try {
        const geoRes = await fetch('/api/geocode?zip=' + zip);
        if (!geoRes.ok) {
          throw new Error('Could not find that zip code');
        }
        const geoData: GeoData = await geoRes.json();
        setLocation(geoData);

        const weatherRes = await fetch(
          '/api/weather?lat=' + geoData.lat + '&lon=' + geoData.lon + '&month=' + month + '&day=' + day + '&years=' + yearsBack
        );
        if (!weatherRes.ok) {
          throw new Error('Could not fetch weather data');
        }
        const weatherData = await weatherRes.json();
        setResults(weatherData.data);
        setStats(weatherData.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [zip, month, day]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const trend = results && results.length > 2
    ? calculateTrend(results.filter(r => r.avg !== null).map(r => ({ year: r.year, temp: r.avg as number })))
    : null;

  const dateDisplay = formatDate(parseInt(month), parseInt(day));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
        }}
      />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <a href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New lookup
          </a>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
            Weather on {dateDisplay}
          </h1>
          <p className="text-slate-400 text-lg">
            {loading ? 'Loading location...' : location ? location.display : 'ZIP ' + zip}
          </p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-amber-500 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-400">Fetching {yearsBack} years of weather data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center">
            {error}
          </div>
        )}

        {results && stats && location && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {yearsBack} Years of Data
                </h2>
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-white transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="text-slate-400 text-sm mb-1">Avg High</div>
                <div className="text-2xl font-bold text-white">
                  {stats.avgHigh !== null ? stats.avgHigh + '°F' : '—'}
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="text-slate-400 text-sm mb-1">Avg Low</div>
                <div className="text-2xl font-bold text-white">
                  {stats.avgLow !== null ? stats.avgLow + '°F' : '—'}
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="text-slate-400 text-sm mb-1">Warmest</div>
                <div className="text-2xl font-bold text-orange-400">
                  {stats.warmestYear ? String(stats.warmestYear.year) : '—'}
                </div>
                {stats.warmestYear && (
                  <div className="text-slate-500 text-sm">{Math.round(stats.warmestYear.temp)}°F avg</div>
                )}
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <div className="text-slate-400 text-sm mb-1">Coldest</div>
                <div className="text-2xl font-bold text-blue-400">
                  {stats.coldestYear ? String(stats.coldestYear.year) : '—'}
                </div>
                {stats.coldestYear && (
                  <div className="text-slate-500 text-sm">{Math.round(stats.coldestYear.temp)}°F avg</div>
                )}
              </div>
            </div>

            {trend && trend.direction !== 'stable' && (
              <div className={'p-4 rounded-xl border ' + (
                trend.direction === 'warming'
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-blue-500/10 border-blue-500/20'
              )}>
                <div className="flex items-center gap-3">
                  <div className={'p-2 rounded-lg ' + (
                    trend.direction === 'warming' ? 'bg-orange-500/20' : 'bg-blue-500/20'
                  )}>
                    {trend.direction === 'warming' ? (
                      <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className={'font-medium ' + (
                      trend.direction === 'warming' ? 'text-orange-400' : 'text-blue-400'
                    )}>
                      {trend.direction === 'warming' ? 'Warming Trend' : 'Cooling Trend'}
                    </div>
                    <div className="text-slate-400 text-sm">
                      {Math.abs(trend.slope).toFixed(1)}°F per decade on this date
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Year</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">High</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Low</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Avg</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Precip</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Snow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row) => (
                      <tr
                        key={row.year}
                        className={'border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ' + (
                          stats.warmestYear?.year === row.year ? 'bg-orange-500/5' :
                          stats.coldestYear?.year === row.year ? 'bg-blue-500/5' : ''
                        )}
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          {row.year}
                          {stats.warmestYear?.year === row.year && (
                            <span className="ml-2 text-xs text-orange-400">warmest</span>
                          )}
                          {stats.coldestYear?.year === row.year && (
                            <span className="ml-2 text-xs text-blue-400">coldest</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-400">
                          {row.high !== null ? row.high + '°' : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400">
                          {row.low !== null ? row.low + '°' : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {row.avg !== null ? Math.round(row.avg) + '°' : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {row.precip !== null && row.precip > 0 ? row.precip + '"' : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {row.snow !== null && row.snow > 0 ? row.snow + '"' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-700/30 text-sm text-slate-500">
                {stats.dataPoints} years of data from {stats.stationName ? stats.stationName : 'NOAA'}
              </div>
            </div>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          <p>Weather data provided by NOAA Climate Data Online. Not for critical planning.</p>
        </footer>
      </main>
    </div>
  );
}
