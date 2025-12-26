import { NextRequest, NextResponse } from 'next/server';

// US zip code to lat/lng mapping using Zippopotam.us (free, no API key)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const zip = searchParams.get('zip');

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
  }

  try {
    // Use Zippopotam.us - free, reliable zip code API
    const response = await fetch(
      `https://api.zippopotam.us/us/${zip}`,
      { next: { revalidate: 86400 * 30 } } // Cache for 30 days
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Zip code not found' }, { status: 404 });
      }
      throw new Error(`Zippopotam API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.places && data.places.length > 0) {
      const place = data.places[0];

      return NextResponse.json({
        lat: parseFloat(place.latitude),
        lon: parseFloat(place.longitude),
        city: place['place name'],
        state: place['state abbreviation'],
        display: `${place['place name']}, ${place['state abbreviation']}`
      });
    }

    return NextResponse.json({ error: 'Zip code not found' }, { status: 404 });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
