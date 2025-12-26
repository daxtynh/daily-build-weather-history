export function formatDate(month: number, day: number): string {
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function getMonthName(month: number): string {
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5) + 32);
}

export function calculateTrend(data: { year: number; temp: number }[]): { slope: number; direction: 'warming' | 'cooling' | 'stable' } {
  if (data.length < 2) return { slope: 0, direction: 'stable' };
  
  const n = data.length;
  const sumX = data.reduce((a, b) => a + b.year, 0);
  const sumY = data.reduce((a, b) => a + b.temp, 0);
  const sumXY = data.reduce((a, b) => a + b.year * b.temp, 0);
  const sumX2 = data.reduce((a, b) => a + b.year * b.year, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Per decade change
  const perDecade = slope * 10;
  
  if (Math.abs(perDecade) < 0.3) return { slope: perDecade, direction: 'stable' };
  return { slope: perDecade, direction: perDecade > 0 ? 'warming' : 'cooling' };
}
