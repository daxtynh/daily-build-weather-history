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
- **Neon Postgres** - Self-hosted NOAA weather data for instant queries
- Zippopotam.us API (geocoding)
- Vercel Analytics

## Architecture

### Database (Neon Postgres)

Two tables store all US weather station data:

**`stations`** - ~12,000 US weather stations
- id, name, latitude, longitude, elevation
- min_date, max_date (data coverage)

**`weather_daily`** - ~50-80 million rows
- station_id, date, month, day
- tmax, tmin (tenths of degrees F)
- prcp (hundredths of inches), snow (tenths of inches)

### Query Flow

1. User enters ZIP code → Zippopotam.us returns lat/lon
2. Find nearest station with data for that month/day
3. Query all years for that station + date
4. Return historical data instantly (<100ms)

### Data Import

NOAA GHCND bulk data is imported via Python script:
- Downloads station metadata from NOAA
- Downloads ghcnd_all.tar.gz (~4GB compressed)
- Parses fixed-width .dly files
- Imports last 25 years of US station data

## Setup Instructions

### 1. Create Neon Database

1. Go to Vercel Dashboard → Storage → Create Database
2. Select "Neon Postgres" integration
3. Create new database
4. Copy the `DATABASE_URL` connection string

### 2. Import NOAA Data

```bash
# Install Python dependencies
cd scripts
pip install -r requirements.txt

# Set database URL
export DATABASE_URL="postgres://user:password@host.neon.tech/dbname?sslmode=require"

# Run import (takes 30-60 minutes)
python import_noaa.py
```

The script will:
- Create database schema
- Download and import ~12,000 US stations
- Import 25 years of daily weather data
- Update station date ranges

### 3. Deploy

```bash
# Add DATABASE_URL to Vercel
vercel env add DATABASE_URL

# Deploy
vercel --prod
```

## Environment Variables

```
DATABASE_URL=postgres://user:password@host.neon.tech/dbname?sslmode=require
```

## Pricing Model (Future)

**Free tier**: 5 lookups/day
**Pro ($9/month)**: Unlimited lookups, CSV export, embed widget
**API ($29/month)**: Direct API access for apps

## pSEO Structure

URLs are structured for SEO:
- `/10001/7/4` = Weather on July 4th in NYC
- `/90210/12/25` = Weather on Christmas in Beverly Hills
- Each page has unique meta tags for search indexing

## Database Costs

Neon free tier includes:
- 0.5 GB storage
- 191 compute hours/month
- Autoscaling to zero

For full dataset (~10-15GB), Neon Pro starts at $19/month.

## Next Steps

1. Create Neon database via Vercel integration
2. Run import script to load NOAA data
3. Deploy with DATABASE_URL
4. Add rate limiting to prevent abuse
5. Add CSV export (Pro feature)
6. Submit sitemap to Google for pSEO pages
