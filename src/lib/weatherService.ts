/**
 * Weather Service — fetch real weather conditions for venue location
 * Uses Open-Meteo (free, no API key required)
 */

export interface WeatherConditions {
  temperature: number;         // °C
  humidity: number;            // %
  windSpeed: number;           // m/s
  windDirection: number;       // degrees
  windGusts: number;           // m/s
  precipitation: number;       // mm
  cloudCover: number;          // %
  visibility: number;          // m
  pressure: number;            // hPa
  weatherCode: number;         // WMO code
  isDaylight: boolean;
  timestamp: string;
}

export interface WeatherForecast {
  current: WeatherConditions;
  hourly: WeatherConditions[];
  fetchedAt: number;
}

export interface FlightRisk {
  level: 'safe' | 'caution' | 'warning' | 'grounded';
  score: number; // 0-100, higher = more risk
  factors: { label: string; value: string; risk: 'ok' | 'caution' | 'danger' }[];
  recommendation: string;
}

const WMO_CODES: Record<number, string> = {
  0: 'Céu limpo', 1: 'Quase limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Neblina', 48: 'Neblina com gelo', 51: 'Garoa leve', 53: 'Garoa moderada',
  55: 'Garoa forte', 61: 'Chuva leve', 63: 'Chuva moderada', 65: 'Chuva forte',
  71: 'Neve leve', 73: 'Neve moderada', 75: 'Neve forte', 77: 'Grãos de neve',
  80: 'Pancadas leves', 81: 'Pancadas moderadas', 82: 'Pancadas fortes',
  85: 'Neve em pancadas', 86: 'Neve forte em pancadas',
  95: 'Tempestade', 96: 'Tempestade com granizo leve', 99: 'Tempestade com granizo forte',
};

export function getWeatherDescription(code: number): string {
  return WMO_CODES[code] || 'Desconhecido';
}

/**
 * Fetch current weather + 24h forecast from Open-Meteo
 */
export async function fetchWeather(lat: number, lng: number): Promise<WeatherForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,weather_code,is_day&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,visibility,surface_pressure,weather_code,is_day&forecast_days=1&wind_speed_unit=ms`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
  const data = await resp.json();

  const current: WeatherConditions = {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    windGusts: data.current.wind_gusts_10m,
    precipitation: data.current.precipitation,
    cloudCover: data.current.cloud_cover,
    visibility: 10000,
    pressure: data.current.surface_pressure,
    weatherCode: data.current.weather_code,
    isDaylight: data.current.is_day === 1,
    timestamp: data.current.time,
  };

  const hourly: WeatherConditions[] = (data.hourly?.time || []).map((t: string, i: number) => ({
    temperature: data.hourly.temperature_2m[i],
    humidity: data.hourly.relative_humidity_2m[i],
    windSpeed: data.hourly.wind_speed_10m[i],
    windDirection: data.hourly.wind_direction_10m[i],
    windGusts: data.hourly.wind_gusts_10m[i],
    precipitation: data.hourly.precipitation[i],
    cloudCover: data.hourly.cloud_cover[i],
    visibility: data.hourly.visibility?.[i] ?? 10000,
    pressure: data.hourly.surface_pressure[i],
    weatherCode: data.hourly.weather_code[i],
    isDaylight: data.hourly.is_day[i] === 1,
    timestamp: t,
  }));

  return { current, hourly, fetchedAt: Date.now() };
}

/**
 * Analyze flight risk based on weather conditions
 */
export function analyzeFlightRisk(weather: WeatherConditions): FlightRisk {
  const factors: FlightRisk['factors'] = [];
  let riskScore = 0;

  // Wind speed
  if (weather.windSpeed > 12) { factors.push({ label: 'Vento', value: `${weather.windSpeed.toFixed(1)} m/s`, risk: 'danger' }); riskScore += 40; }
  else if (weather.windSpeed > 8) { factors.push({ label: 'Vento', value: `${weather.windSpeed.toFixed(1)} m/s`, risk: 'caution' }); riskScore += 20; }
  else { factors.push({ label: 'Vento', value: `${weather.windSpeed.toFixed(1)} m/s`, risk: 'ok' }); }

  // Gusts
  if (weather.windGusts > 15) { factors.push({ label: 'Rajadas', value: `${weather.windGusts.toFixed(1)} m/s`, risk: 'danger' }); riskScore += 30; }
  else if (weather.windGusts > 10) { factors.push({ label: 'Rajadas', value: `${weather.windGusts.toFixed(1)} m/s`, risk: 'caution' }); riskScore += 15; }
  else { factors.push({ label: 'Rajadas', value: `${weather.windGusts.toFixed(1)} m/s`, risk: 'ok' }); }

  // Precipitation
  if (weather.precipitation > 2) { factors.push({ label: 'Chuva', value: `${weather.precipitation} mm`, risk: 'danger' }); riskScore += 35; }
  else if (weather.precipitation > 0) { factors.push({ label: 'Chuva', value: `${weather.precipitation} mm`, risk: 'caution' }); riskScore += 15; }
  else { factors.push({ label: 'Chuva', value: '0 mm', risk: 'ok' }); }

  // Visibility
  if (weather.visibility < 1000) { factors.push({ label: 'Visibilidade', value: `${weather.visibility}m`, risk: 'danger' }); riskScore += 25; }
  else if (weather.visibility < 3000) { factors.push({ label: 'Visibilidade', value: `${(weather.visibility / 1000).toFixed(1)}km`, risk: 'caution' }); riskScore += 10; }
  else { factors.push({ label: 'Visibilidade', value: `${(weather.visibility / 1000).toFixed(0)}km`, risk: 'ok' }); }

  // Temperature
  if (weather.temperature < -5 || weather.temperature > 45) { factors.push({ label: 'Temperatura', value: `${weather.temperature}°C`, risk: 'danger' }); riskScore += 15; }
  else if (weather.temperature < 0 || weather.temperature > 38) { factors.push({ label: 'Temperatura', value: `${weather.temperature}°C`, risk: 'caution' }); riskScore += 5; }
  else { factors.push({ label: 'Temperatura', value: `${weather.temperature}°C`, risk: 'ok' }); }

  // Thunder
  if (weather.weatherCode >= 95) { factors.push({ label: 'Tempestade', value: getWeatherDescription(weather.weatherCode), risk: 'danger' }); riskScore += 50; }

  const level: FlightRisk['level'] =
    riskScore >= 70 ? 'grounded' :
    riskScore >= 40 ? 'warning' :
    riskScore >= 20 ? 'caution' : 'safe';

  const recommendations: Record<FlightRisk['level'], string> = {
    safe: 'Condições ideais para voo. Todas as operações liberadas.',
    caution: 'Condições aceitáveis com precaução. Monitore as mudanças.',
    warning: 'Condições marginais. Considere adiar ou reduzir altitude.',
    grounded: 'Voo NÃO recomendado. Condições meteorológicas perigosas.',
  };

  return { level, score: Math.min(100, riskScore), factors, recommendation: recommendations[level] };
}

/**
 * Get wind direction as compass string
 */
export function windDirectionToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
