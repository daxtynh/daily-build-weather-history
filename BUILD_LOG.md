# What Was the Weather?

**Live URL**: https://weather-history-three.vercel.app
**GitHub**: https://github.com/daxtynh/daily-build-weather-history

## Problem Solved

People need to know historical weather for specific dates:
- Event planners checking what weather was like on past dates for outdoor events
- Travelers researching typical weather for vacation dates
- Gardeners knowing frost/heat patterns
- Content creators needing weather context for stories
- Real estate agents describing neighborhood weather patterns

Current solutions are:
- Weather Underground: Cluttered, hard to get specific date history
- NOAA: Government site, complex interface
- Paid APIs: Require coding knowledge

## Target Customer

- **Event planners** planning outdoor weddings, festivals, sports events
- **Travel bloggers** writing about destination weather
- **Gardeners** tracking growing season patterns
- **Anyone** curious about weather patterns on specific dates

## What It Does

1. Enter a US ZIP code + month + day
2. Instantly see weather data for that date going back 20 years
3. Shows: high/low temps, average, precipitation, snow
4. Highlights warmest and coldest years
5. Shows temperature trend (warming/cooling) per decade
6. One-click shareable URLs for pSEO

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS
- NOAA Climate Data Online API (free, 1000 requests/day)
- Census Bureau Geocoder (free, no API key)
- Vercel Analytics

## Pricing Model (Future)

**Free tier**: 5 lookups/day
**Pro ($9/month)**: Unlimited lookups, CSV export, embed widget
**API ($29/month)**: Direct API access for apps

## pSEO Structure

URLs are structured for SEO:
- `/10001/7/4` = Weather on July 4th in NYC
- `/90210/12/25` = Weather on Christmas in Beverly Hills
- Each page has unique meta tags for search indexing

## Environment Variables Needed

```
NOAA_API_KEY=your_key_from_noaa
```

Get your free key at: https://www.ncdc.noaa.gov/cdo-web/token
Free tier: 1000 requests/day, 5 requests/second

## Next Steps

1. Add NOAA key via Vercel dashboard: `vercel env add NOAA_API_KEY`
2. Add rate limiting to prevent API abuse
3. Add CSV export (Pro feature)
4. Add weather embed widget (Pro feature)
5. Submit sitemap to Google for pSEO pages
