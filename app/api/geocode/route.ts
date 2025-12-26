import { NextRequest, NextResponse } from 'next/server';

// Simple US zip code to lat/lng mapping using Census Bureau Geocoder
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const zip = searchParams.get('zip');
  
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
  }
  
  try {
    // Use Census Bureau geocoder - free, no API key needed
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${zip}&benchmark=2020&format=json`,
      { next: { revalidate: 86400 * 30 } } // Cache for 30 days
    );
    
    const data = await response.json();
    
    if (data.result?.addressMatches?.length > 0) {
      const match = data.result.addressMatches[0];
      const coords = match.coordinates;
      const address = match.matchedAddress;
      
      // Extract city/state from matched address
      const parts = address.split(', ');
      const city = parts[0] || '';
      const stateZip = parts[1] || '';
      const state = stateZip.split(' ')[0] || '';
      
      return NextResponse.json({
        lat: coords.y,
        lon: coords.x,
        city,
        state,
        display: `${city}, ${state}`
      });
    }
    
    return NextResponse.json({ error: 'Zip code not found' }, { status: 404 });
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
