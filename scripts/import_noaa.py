"""
NOAA GHCND Data Import Script

Downloads and imports US weather station data from NOAA into Neon database.

Usage:
  1. Set DATABASE_URL environment variable
  2. Run: python import_noaa.py

Data source: https://www.ncei.noaa.gov/pub/data/ghcn/daily/
"""

import os
import sys
import gzip
import tarfile
import tempfile
import urllib.request
from datetime import datetime, date
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values

# Configuration
NOAA_BASE_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily"
STATIONS_URL = f"{NOAA_BASE_URL}/ghcnd-stations.txt"
DATA_URL = f"{NOAA_BASE_URL}/ghcnd_all.tar.gz"

# Only import last N years
YEARS_TO_IMPORT = 25  # Extra buffer for 20 years of queries
MIN_YEAR = datetime.now().year - YEARS_TO_IMPORT

# Batch size for inserts
BATCH_SIZE = 10000


def get_db_connection():
    """Get database connection from environment variable."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    return psycopg2.connect(db_url)


def create_schema(conn):
    """Create database tables if they don't exist."""
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path) as f:
        schema_sql = f.read()

    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()
    print("Schema created successfully")


def download_stations(conn):
    """Download and import station metadata."""
    print("Downloading station metadata...")

    stations = []
    with urllib.request.urlopen(STATIONS_URL) as response:
        for line in response:
            line = line.decode('utf-8')
            station_id = line[0:11].strip()

            # Only US stations
            if not station_id.startswith("US"):
                continue

            lat = float(line[12:20].strip())
            lon = float(line[21:30].strip())
            elev = float(line[31:37].strip()) if line[31:37].strip() else None
            name = line[41:71].strip()

            stations.append((station_id, name, lat, lon, elev))

    print(f"Found {len(stations)} US stations")

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO stations (id, name, latitude, longitude, elevation)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                elevation = EXCLUDED.elevation
            """,
            stations
        )
    conn.commit()
    print(f"Imported {len(stations)} stations")
    return set(s[0] for s in stations)


def parse_dly_file(file_content, station_id):
    """
    Parse NOAA .dly file format.

    Format (fixed width):
    - Cols 1-11: Station ID
    - Cols 12-15: Year
    - Cols 16-17: Month
    - Cols 18-21: Element (TMAX, TMIN, PRCP, SNOW)
    - Cols 22+: 31 daily values (8 chars each: 5 value + 3 flags)
    """
    records = {}  # (date) -> {tmax, tmin, prcp, snow}

    for line in file_content.split('\n'):
        if len(line) < 269:
            continue

        year = int(line[11:15])
        if year < MIN_YEAR:
            continue

        month = int(line[15:17])
        element = line[17:21]

        if element not in ('TMAX', 'TMIN', 'PRCP', 'SNOW'):
            continue

        # Parse 31 daily values
        for day in range(1, 32):
            start = 21 + (day - 1) * 8
            value_str = line[start:start + 5].strip()

            if value_str == "-9999" or not value_str:
                continue

            try:
                value = int(value_str)
            except ValueError:
                continue

            # Validate date
            try:
                d = date(year, month, day)
            except ValueError:
                continue

            if d not in records:
                records[d] = {}

            # NOAA stores temps in tenths of Celsius, convert to tenths of Fahrenheit
            if element in ('TMAX', 'TMIN'):
                value = int(value * 9 / 5 + 320)  # Convert to tenths of F

            records[d][element.lower()] = value

    # Convert to tuples for insertion
    result = []
    for d, data in records.items():
        if 'tmax' in data or 'tmin' in data:  # Only include days with temp data
            result.append((
                station_id,
                d,
                d.month,
                d.day,
                data.get('tmax'),
                data.get('tmin'),
                data.get('prcp'),
                data.get('snow')
            ))

    return result


def import_weather_data(conn, us_stations):
    """Download and import weather data from NOAA."""
    print("Downloading NOAA weather data (this may take a while)...")

    # Download to temp file
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        tmp_path = tmp.name
        print(f"Downloading to {tmp_path}...")
        urllib.request.urlretrieve(DATA_URL, tmp_path)

    print("Download complete. Processing files...")

    total_records = 0
    stations_processed = 0
    batch = []

    try:
        with tarfile.open(tmp_path, 'r:gz') as tar:
            for member in tar:
                if not member.name.endswith('.dly'):
                    continue

                # Extract station ID from filename
                station_id = Path(member.name).stem

                # Only process US stations
                if not station_id.startswith('US'):
                    continue

                # Extract and parse file
                f = tar.extractfile(member)
                if f is None:
                    continue

                content = f.read().decode('utf-8', errors='ignore')
                records = parse_dly_file(content, station_id)

                if records:
                    batch.extend(records)
                    stations_processed += 1

                    # Insert in batches
                    if len(batch) >= BATCH_SIZE:
                        insert_batch(conn, batch)
                        total_records += len(batch)
                        print(f"  Processed {stations_processed} stations, {total_records:,} records...")
                        batch = []

        # Insert remaining records
        if batch:
            insert_batch(conn, batch)
            total_records += len(batch)

    finally:
        # Cleanup temp file
        os.unlink(tmp_path)

    print(f"Import complete: {stations_processed} stations, {total_records:,} records")


def insert_batch(conn, records):
    """Insert a batch of weather records."""
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO weather_daily (station_id, date, month, day, tmax, tmin, prcp, snow)
            VALUES %s
            ON CONFLICT (station_id, date) DO UPDATE SET
                tmax = EXCLUDED.tmax,
                tmin = EXCLUDED.tmin,
                prcp = EXCLUDED.prcp,
                snow = EXCLUDED.snow
            """,
            records
        )
    conn.commit()


def update_station_date_ranges(conn):
    """Update min/max date ranges for each station."""
    print("Updating station date ranges...")
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE stations s SET
                min_date = sub.min_date,
                max_date = sub.max_date
            FROM (
                SELECT station_id, MIN(date) as min_date, MAX(date) as max_date
                FROM weather_daily
                GROUP BY station_id
            ) sub
            WHERE s.id = sub.station_id
        """)
    conn.commit()
    print("Date ranges updated")


def main():
    print("=" * 60)
    print("NOAA Weather Data Import")
    print("=" * 60)
    print(f"Importing data from {MIN_YEAR} to present")
    print()

    conn = get_db_connection()

    try:
        # Create schema
        create_schema(conn)

        # Import stations
        us_stations = download_stations(conn)

        # Import weather data
        import_weather_data(conn, us_stations)

        # Update date ranges
        update_station_date_ranges(conn)

        print()
        print("=" * 60)
        print("Import complete!")
        print("=" * 60)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
