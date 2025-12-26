import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WeatherClient from './client';

interface PageProps {
  params: Promise<{
    zip: string;
    month: string;
    day: string;
  }>;
}

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}

function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { zip, month, day } = await params;

  const monthNum = parseInt(month);
  const dayNum = parseInt(day);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return {};
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return {};

  const monthName = getMonthName(monthNum);
  const dateStr = monthName + ' ' + formatOrdinal(dayNum);

  const title = 'Weather on ' + dateStr + ' in ZIP ' + zip + ' | Historical Weather Data';
  const description = 'See what the weather was like on ' + dateStr + ' near ZIP code ' + zip + ' for the past 20 years. Compare temperatures, precipitation, and trends.';

  return {
    title,
    description,
    openGraph: {
      title: 'Weather History: ' + dateStr + ' (' + zip + ')',
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Weather History: ' + dateStr,
      description,
    },
  };
}

export default async function WeatherPage({ params }: PageProps) {
  const { zip, month, day } = await params;

  // Validate params
  if (!/^\d{5}$/.test(zip)) {
    notFound();
  }

  const monthNum = parseInt(month);
  const dayNum = parseInt(day);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    notFound();
  }
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    notFound();
  }

  return <WeatherClient zip={zip} month={month} day={day} />;
}
