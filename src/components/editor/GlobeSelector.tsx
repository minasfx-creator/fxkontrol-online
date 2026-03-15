import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Search, MapPin, Crosshair, ChevronDown, Navigation, Edit3, Globe, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import earthTexture from '@/assets/earth-texture.jpg';

// ─── City database (60+ venues) ───
const CITIES = [
  // Brazil
  { name: 'São Paulo, Brasil', lat: -23.5505, lng: -46.6333, country: 'BR', icon: '🇧🇷' },
  { name: 'Belo Horizonte, Brasil', lat: -19.9167, lng: -43.9345, country: 'BR', icon: '🇧🇷' },
  { name: 'Rio de Janeiro, Brasil', lat: -22.9068, lng: -43.1729, country: 'BR', icon: '🇧🇷' },
  { name: 'Brasília, Brasil', lat: -15.7801, lng: -47.9292, country: 'BR', icon: '🇧🇷' },
  { name: 'Copacabana Beach, Rio', lat: -22.9711, lng: -43.1823, country: 'BR', icon: '🏖️' },
  { name: 'Recife, Brasil', lat: -8.0476, lng: -34.877, country: 'BR', icon: '🇧🇷' },
  { name: 'Salvador, Brasil', lat: -12.9714, lng: -38.5124, country: 'BR', icon: '🇧🇷' },
  { name: 'Florianópolis, Brasil', lat: -27.5954, lng: -48.548, country: 'BR', icon: '🇧🇷' },
  { name: 'Curitiba, Brasil', lat: -25.4284, lng: -49.2733, country: 'BR', icon: '🇧🇷' },
  { name: 'Manaus, Brasil', lat: -3.119, lng: -60.0217, country: 'BR', icon: '🇧🇷' },
  // Middle East
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, country: 'AE', icon: '🇦🇪' },
  { name: 'Abu Dhabi, UAE', lat: 24.4539, lng: 54.3773, country: 'AE', icon: '🇦🇪' },
  { name: 'Jeddah, Saudi Arabia', lat: 21.4858, lng: 39.1925, country: 'SA', icon: '🇸🇦' },
  { name: 'Riyadh, Saudi Arabia', lat: 24.7136, lng: 46.6753, country: 'SA', icon: '🇸🇦' },
  { name: 'NEOM, Saudi Arabia', lat: 28.0, lng: 35.0, country: 'SA', icon: '🏗️' },
  { name: 'Doha, Qatar', lat: 25.2854, lng: 51.531, country: 'QA', icon: '🇶🇦' },
  // Americas
  { name: 'New York, USA', lat: 40.7128, lng: -74.006, country: 'US', icon: '🇺🇸' },
  { name: 'Las Vegas, USA', lat: 36.1699, lng: -115.1398, country: 'US', icon: '🎰' },
  { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437, country: 'US', icon: '🇺🇸' },
  { name: 'Miami, USA', lat: 25.7617, lng: -80.1918, country: 'US', icon: '🇺🇸' },
  { name: 'Mexico City, Mexico', lat: 19.4326, lng: -99.1332, country: 'MX', icon: '🇲🇽' },
  { name: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, country: 'AR', icon: '🇦🇷' },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, country: 'CA', icon: '🇨🇦' },
  { name: 'Lima, Peru', lat: -12.0464, lng: -77.0428, country: 'PE', icon: '🇵🇪' },
  { name: 'Santiago, Chile', lat: -33.4489, lng: -70.6693, country: 'CL', icon: '🇨🇱' },
  { name: 'Bogotá, Colombia', lat: 4.711, lng: -74.0721, country: 'CO', icon: '🇨🇴' },
  // Europe
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, country: 'GB', icon: '🇬🇧' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, country: 'FR', icon: '🇫🇷' },
  { name: 'Berlin, Germany', lat: 52.52, lng: 13.405, country: 'DE', icon: '🇩🇪' },
  { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964, country: 'IT', icon: '🇮🇹' },
  { name: 'Barcelona, Spain', lat: 41.3874, lng: 2.1686, country: 'ES', icon: '🇪🇸' },
  { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041, country: 'NL', icon: '🇳🇱' },
  { name: 'Moscow, Russia', lat: 55.7558, lng: 37.6173, country: 'RU', icon: '🇷🇺' },
  { name: 'Stockholm, Sweden', lat: 59.3293, lng: 18.0686, country: 'SE', icon: '🇸🇪' },
  { name: 'Zurich, Switzerland', lat: 47.3769, lng: 8.5417, country: 'CH', icon: '🇨🇭' },
  { name: 'Athens, Greece', lat: 37.9838, lng: 23.7275, country: 'GR', icon: '🇬🇷' },
  // Asia-Pacific
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP', icon: '🇯🇵' },
  { name: 'Beijing, China', lat: 39.9042, lng: 116.4074, country: 'CN', icon: '🇨🇳' },
  { name: 'Shanghai, China', lat: 31.2304, lng: 121.4737, country: 'CN', icon: '🇨🇳' },
  { name: 'Shenzhen, China', lat: 22.5431, lng: 114.0579, country: 'CN', icon: '🇨🇳' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'SG', icon: '🇸🇬' },
  { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.978, country: 'KR', icon: '🇰🇷' },
  { name: 'Mumbai, India', lat: 19.076, lng: 72.8777, country: 'IN', icon: '🇮🇳' },
  { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH', icon: '🇹🇭' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, country: 'AU', icon: '🇦🇺' },
  { name: 'Melbourne, Australia', lat: -37.8136, lng: 144.9631, country: 'AU', icon: '🇦🇺' },
  { name: 'Auckland, New Zealand', lat: -36.8485, lng: 174.7633, country: 'NZ', icon: '🇳🇿' },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'HK', icon: '🇭🇰' },
  // Africa
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, country: 'EG', icon: '🇪🇬' },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, country: 'ZA', icon: '🇿🇦' },
  { name: 'Lagos, Nigeria', lat: 6.5244, lng: 3.3792, country: 'NG', icon: '🇳🇬' },
  { name: 'Nairobi, Kenya', lat: -1.2921, lng: 36.8219, country: 'KE', icon: '🇰🇪' },
  { name: 'Marrakech, Morocco', lat: 31.6295, lng: -7.9811, country: 'MA', icon: '🇲🇦' },
];

const GLOBE_RADIUS = 2.5;

function latLngToSphere(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function sphereToLatLng(point: THREE.Vector3): { lat: number; lng: number } {
  const r = point.length();
  const lat = 90 - (Math.acos(point.y / r) * 180) / Math.PI;
  const lng = (Math.atan2(point.z, -point.x) * 180) / Math.PI - 180;
  return { lat, lng: lng < -180 ? lng + 360 : lng > 180 ? lng - 360 : lng };
}

// ─── Atmosphere shader ───
function Atmosphere() {
  return (
    <mesh scale={[1.15, 1.15, 1.15]}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 color = mix(vec3(0.3, 0.6, 1.0), vec3(0.1, 0.4, 0.9), intensity);
            gl_FragColor = vec4(color, intensity * 0.7);
          }
        `}
      />
    </mesh>
  );
}

// ─── Inner atmosphere glow ───
function InnerGlow() {
  return (
    <mesh scale={[1.02, 1.02, 1.02]}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-( modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            rim = pow(rim, 3.0);
            vec3 color = vec3(0.4, 0.7, 1.0);
            gl_FragColor = vec4(color, rim * 0.25);
          }
        `}
      />
    </mesh>
  );
}

// ─── City pins (only visible near cities) ───
function CityPins({ cities, selectedName, onSelect }: {
  cities: typeof CITIES;
  selectedName: string | null;
  onSelect: (city: typeof CITIES[0]) => void;
}) {
  return (
    <group>
      {cities.map((city) => {
        const pos = latLngToSphere(city.lat, city.lng, GLOBE_RADIUS + 0.02);
        const isSelected = selectedName === city.name;
        return (
          <group key={city.name} position={pos}>
            <mesh onClick={(e) => { e.stopPropagation(); onSelect(city); }}>
              <sphereGeometry args={[isSelected ? 0.05 : 0.022, 12, 12]} />
              <meshBasicMaterial color={isSelected ? '#f97316' : '#3b82f6'} />
            </mesh>
            {/* Pulse ring for selected */}
            {isSelected && (
              <>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.06, 0.08, 24]} />
                  <meshBasicMaterial color="#f97316" transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
                <Html distanceFactor={8} center style={{ pointerEvents: 'none' }}>
                  <div className="bg-surface-1/95 backdrop-blur-sm border border-electric/30 rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
                    <p className="text-[11px] font-mono-code text-electric font-semibold">{city.icon} {city.name}</p>
                    <p className="text-[9px] text-muted-foreground">{city.lat.toFixed(4)}°, {city.lng.toFixed(4)}°</p>
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─── Free-click pin ───
function FreePin({ lat, lng }: { lat: number; lng: number }) {
  const pos = latLngToSphere(lat, lng, GLOBE_RADIUS + 0.02);
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.07, 0.09, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <Html distanceFactor={8} center style={{ pointerEvents: 'none' }}>
        <div className="bg-surface-1/95 backdrop-blur-sm border border-success/30 rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
          <p className="text-[11px] font-mono-code text-success font-semibold">📍 Custom Location</p>
          <p className="text-[9px] text-muted-foreground">{lat.toFixed(6)}°, {lng.toFixed(6)}°</p>
        </div>
      </Html>
    </group>
  );
}

// ─── Camera zoom controller ───
function CameraZoomTo({ target, zooming }: { target: THREE.Vector3 | null; zooming: boolean }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 8));

  useEffect(() => {
    if (target && zooming) {
      const dir = target.clone().normalize();
      targetPos.current = dir.multiplyScalar(4.2);
    }
  }, [target, zooming]);

  useFrame(() => {
    if (zooming && target) {
      camera.position.lerp(targetPos.current, 0.025);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// ─── Clickable Earth Globe ───
function EarthGlobe({ onClickGlobe }: { onClickGlobe: (lat: number, lng: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, earthTexture);
  const autoRotate = useRef(true);
  const rotationOffset = useRef(0);

  useFrame(({ clock }) => {
    if (meshRef.current && autoRotate.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.025 + rotationOffset.current;
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!meshRef.current) return;
    // Get click point in local space, undo rotation
    const localPoint = e.point.clone();
    const inverseMatrix = new THREE.Matrix4().copy(meshRef.current.matrixWorld).invert();
    localPoint.applyMatrix4(inverseMatrix);
    const { lat, lng } = sphereToLatLng(localPoint);
    autoRotate.current = false;
    onClickGlobe(lat, lng);
  }, [onClickGlobe]);

  return (
    <mesh ref={meshRef} onClick={handleClick}>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 128]} />
      <meshStandardMaterial map={texture} roughness={0.82} metalness={0.08} />
    </mesh>
  );
}

// ─── Coordinate grid lines ───
function CoordinateGrid() {
  const lines = useMemo(() => {
    const pts: THREE.Vector3[][] = [];
    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const line: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 3) {
        line.push(latLngToSphere(lat, lng, GLOBE_RADIUS + 0.005));
      }
      pts.push(line);
    }
    // Longitude lines every 30°
    for (let lng = -180; lng < 180; lng += 30) {
      const line: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        line.push(latLngToSphere(lat, lng, GLOBE_RADIUS + 0.005));
      }
      pts.push(line);
    }
    return pts;
  }, []);

  return (
    <group>
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(pts.flatMap(p => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#3b82f6" transparent opacity={0.08} />
        </line>
      ))}
    </group>
  );
}

// ─── Main component ───
interface GlobeSelectorProps {
  onLocationSelected: (location: { name: string; lat: number; lng: number }) => void;
}

export default function GlobeSelector({ onLocationSelected }: GlobeSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<typeof CITIES[0] | null>(null);
  const [freePin, setFreePin] = useState<{ lat: number; lng: number } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [phase, setPhase] = useState<'browse' | 'confirming' | 'zooming'>('browse');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const filteredCities = useMemo(() => {
    if (!search.trim()) return CITIES.slice(0, 10);
    const q = search.toLowerCase();
    return CITIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [search]);

  const handleSelectCity = useCallback((city: typeof CITIES[0]) => {
    setSelectedCity(city);
    setFreePin(null);
    setSearch(city.name);
    setShowDropdown(false);
    setPhase('confirming');
  }, []);

  const handleClickGlobe = useCallback((lat: number, lng: number) => {
    setFreePin({ lat, lng });
    setSelectedCity(null);
    setSearch(`${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
    setShowDropdown(false);
    setPhase('confirming');
  }, []);

  const handleManualSubmit = useCallback(() => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    setFreePin({ lat, lng });
    setSelectedCity(null);
    setSearch(`${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
    setShowManualInput(false);
    setPhase('confirming');
  }, [manualLat, manualLng]);

  const handleConfirm = useCallback(() => {
    const loc = selectedCity
      ? { name: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng }
      : freePin
        ? { name: `Custom (${freePin.lat.toFixed(4)}°, ${freePin.lng.toFixed(4)}°)`, lat: freePin.lat, lng: freePin.lng }
        : null;
    if (!loc) return;
    setPhase('zooming');
    setZooming(true);
    setTimeout(() => onLocationSelected(loc), 2000);
  }, [selectedCity, freePin, onLocationSelected]);

  const handleReset = useCallback(() => {
    setSelectedCity(null);
    setFreePin(null);
    setSearch('');
    setPhase('browse');
  }, []);

  const zoomTarget = useMemo(() => {
    if (selectedCity) return latLngToSphere(selectedCity.lat, selectedCity.lng, GLOBE_RADIUS);
    if (freePin) return latLngToSphere(freePin.lat, freePin.lng, GLOBE_RADIUS);
    return null;
  }, [selectedCity, freePin]);

  const activeLocation = selectedCity
    ? { name: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng, icon: selectedCity.icon }
    : freePin
      ? { name: 'Custom Location', lat: freePin.lat, lng: freePin.lng, icon: '📍' }
      : null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col transition-opacity duration-700",
      phase === 'zooming' ? 'opacity-0' : 'opacity-100'
    )} style={{ background: 'radial-gradient(ellipse at 40% 50%, hsl(220 18% 7%), hsl(240 12% 3%))' }}>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fxk-cyan to-fxk-orange flex items-center justify-center shadow-[0_0_20px_hsl(var(--fxk-cyan)/0.3)] animate-fxk-glow">
            <Globe className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-foreground font-display">
              FX KONTROL
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase font-display">
              Site Survey · Selecione o Local do Show
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Manual coordinate input */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualInput(!showManualInput)}
            className="h-8 text-[10px] font-mono-code gap-1.5 border-border/50 bg-surface-1/50"
          >
            <Edit3 className="w-3 h-3" />
            GPS Manual
          </Button>

          {/* Search bar */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Buscar cidade, venue, país..."
              className="pl-9 pr-8 h-8 text-xs font-mono-code bg-surface-1/80 backdrop-blur border-border/50 focus:border-electric text-foreground"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />

            {showDropdown && filteredCities.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-1/95 backdrop-blur-md border border-border/50 rounded-md shadow-2xl max-h-72 overflow-y-auto z-50">
                {filteredCities.map((city) => (
                  <button
                    key={city.name}
                    onMouseDown={() => handleSelectCity(city)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-3/50 transition-colors",
                      selectedCity?.name === city.name && "bg-electric/10"
                    )}
                  >
                    <span className="text-sm">{city.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground font-medium truncate">{city.name}</p>
                      <p className="text-[9px] text-muted-foreground">{city.lat.toFixed(4)}°, {city.lng.toFixed(4)}°</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset */}
          {activeLocation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 w-8 p-0 text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Manual input panel */}
      {showManualInput && (
        <div className="absolute top-14 right-6 z-20 bg-surface-1/95 backdrop-blur-md border border-border/50 rounded-lg p-4 shadow-2xl w-72">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-3">
            Coordenadas GPS Manuais
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Latitude (-90 a 90)</label>
              <Input
                type="number"
                step="0.0001"
                min={-90}
                max={90}
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="-23.5505"
                className="h-7 text-xs font-mono-code bg-surface-2 border-border/50 mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Longitude (-180 a 180)</label>
              <Input
                type="number"
                step="0.0001"
                min={-180}
                max={180}
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="-46.6333"
                className="h-7 text-xs font-mono-code bg-surface-2 border-border/50 mt-1"
              />
            </div>
            <Button onClick={handleManualSubmit} size="sm" className="w-full h-7 text-[10px] uppercase tracking-wider mt-2">
              <Navigation className="w-3 h-3 mr-1.5" />
              Definir Origem
            </Button>
          </div>
        </div>
      )}

      {/* 3D Globe */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 3, 5]} intensity={1.3} />
          <pointLight position={[-5, -3, -5]} intensity={0.25} color="#4488ff" />

          <EarthGlobe onClickGlobe={handleClickGlobe} />
          <Atmosphere />
          <InnerGlow />
          <CoordinateGrid />
          <CityPins
            cities={CITIES}
            selectedName={selectedCity?.name ?? null}
            onSelect={handleSelectCity}
          />
          {freePin && <FreePin lat={freePin.lat} lng={freePin.lng} />}
          <CameraZoomTo target={zoomTarget} zooming={zooming} />
          <Stars radius={100} depth={50} count={4000} factor={3} saturation={0} fade speed={0.4} />
          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={3.2}
            maxDistance={18}
            autoRotate={!selectedCity && !freePin}
            autoRotateSpeed={0.25}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>

        {/* Bottom confirmation card */}
        {activeLocation && phase === 'confirming' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-1/90 backdrop-blur-xl border border-electric/20 rounded-xl px-6 py-4 flex items-center gap-5 shadow-[0_8px_40px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-electric/20 to-electric/5 flex items-center justify-center border border-electric/30">
              <span className="text-xl">{activeLocation.icon}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{activeLocation.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono-code">
                {activeLocation.lat.toFixed(6)}° {activeLocation.lat >= 0 ? 'N' : 'S'},{' '}
                {activeLocation.lng.toFixed(6)}° {activeLocation.lng >= 0 ? 'E' : 'W'}
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              className="ml-4 px-7 h-10 text-xs font-bold tracking-[0.15em] uppercase bg-gradient-to-r from-electric to-electric-glow hover:shadow-[0_0_24px_hsl(var(--electric)/0.4)] transition-all"
            >
              <Crosshair className="w-3.5 h-3.5 mr-2" />
              Confirmar Local
            </Button>
          </div>
        )}

        {/* Corner coordinates */}
        <div className="absolute bottom-4 right-4 text-[9px] font-mono-code text-muted-foreground/50 bg-surface-0/50 px-2 py-1 rounded">
          {activeLocation
            ? `${activeLocation.lat.toFixed(4)}°, ${activeLocation.lng.toFixed(4)}°`
            : 'Clique no globo ou busque uma cidade'
          }
        </div>

        {/* Instructions */}
        {!activeLocation && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 text-muted-foreground/60 bg-surface-0/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-border/20">
            <MapPin className="w-4 h-4 text-electric/50" />
            <div>
              <p className="text-[10px] font-mono-code tracking-wider uppercase font-medium">
                Clique em qualquer ponto da Terra
              </p>
              <p className="text-[9px] text-muted-foreground/50">
                Ou use a busca / coordenadas GPS manuais
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="absolute top-3 left-3 text-[9px] font-mono-code text-muted-foreground/40 space-y-0.5">
          <p>{CITIES.length} venues cadastrados</p>
          <p>Click-to-select enabled</p>
        </div>
      </div>
    </div>
  );
}
