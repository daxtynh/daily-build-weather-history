-- Weather History Database Schema for Neon

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100),
  latitude DECIMAL(8, 5),
  longitude DECIMAL(8, 5),
  elevation DECIMAL(7, 1),
  min_date DATE,
  max_date DATE
);

-- Daily weather data table
CREATE TABLE IF NOT EXISTS weather_daily (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  month SMALLINT NOT NULL,
  day SMALLINT NOT NULL,
  tmax SMALLINT,  -- Max temp in tenths of degrees F
  tmin SMALLINT,  -- Min temp in tenths of degrees F
  prcp SMALLINT,  -- Precipitation in hundredths of inches
  snow SMALLINT,  -- Snowfall in tenths of inches
  UNIQUE(station_id, date)
);

-- Index for fast lookups by station + month + day (across all years)
CREATE INDEX IF NOT EXISTS idx_weather_station_month_day
ON weather_daily(station_id, month, day);

-- Index for station lookups
CREATE INDEX IF NOT EXISTS idx_weather_station_id
ON weather_daily(station_id);

-- Spatial index for finding nearby stations (using lat/lon box)
CREATE INDEX IF NOT EXISTS idx_stations_location
ON stations(latitude, longitude);
