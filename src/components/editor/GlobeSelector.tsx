import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Search, MapPin, Crosshair, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import earthTexture from '@/assets/earth-texture.jpg';

// ─── City database ───
const CITIES = [
  { name: 'São Paulo, Brasil', lat: -23.5505, lng: -46.6333, country: 'BR' },
  { name: 'Belo Horizonte, Brasil', lat: -19.9167, lng: -43.9345, country: 'BR' },
  { name: 'Rio de Janeiro, Brasil', lat: -22.9068, lng: -43.1729, country: 'BR' },
  { name: 'Brasília, Brasil', lat: -15.7801, lng: -47.9292, country: 'BR' },
  { name: 'Copacabana Beach, Rio', lat: -22.9711, lng: -43.1823, country: 'BR' },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, country: 'AE' },
  { name: 'Abu Dhabi, UAE', lat: 24.4539, lng: 54.3773, country: 'AE' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, country: 'AU' },
  { name: 'New York, USA', lat: 40.7128, lng: -74.006, country: 'US' },
  { name: 'Las Vegas, USA', lat: 36.1699, lng: -115.1398, country: 'US' },
  { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437, country: 'US' },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, country: 'GB' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, country: 'FR' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP' },
  { name: 'Beijing, China', lat: 39.9042, lng: 116.4074, country: 'CN' },
  { name: 'Shanghai, China', lat: 31.2304, lng: 121.4737, country: 'CN' },
  { name: 'Moscow, Russia', lat: 55.7558, lng: 37.6173, country: 'RU' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'SG' },
  { name: 'Mumbai, India', lat: 19.076, lng: 72.8777, country: 'IN' },
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, country: 'EG' },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, country: 'ZA' },
  { name: 'Jeddah, Saudi Arabia', lat: 21.4858, lng: 39.1925, country: 'SA' },
  { name: 'Riyadh, Saudi Arabia', lat: 24.7136, lng: 46.6753, country: 'SA' },
  { name: 'Mexico City, Mexico', lat: 19.4326, lng: -99.1332, country: 'MX' },
  { name: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, country: 'AR' },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, country: 'CA' },
  { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.978, country: 'KR' },
  { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH' },
  { name: 'Berlin, Germany', lat: 52.52, lng: 13.405, country: 'DE' },
  { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964, country: 'IT' },
];

function latLngToSphere(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// ─── Atmosphere shader ───
function Atmosphere() {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (shaderRef.current) shaderRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh scale={[1.12, 1.12, 1.12]}>
      <sphereGeometry args={[2.5, 64, 64]} />
      <shaderMaterial
        ref={shaderRef}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float uTime;
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

// ─── City pins ───
function CityPins({ cities, selectedCity, onSelect }: {
  cities: typeof CITIES;
  selectedCity: string | null;
  onSelect: (city: typeof CITIES[0]) => void;
}) {
  return (
    <group>
      {cities.map((city) => {
        const pos = latLngToSphere(city.lat, city.lng, 2.52);
        const isSelected = selectedCity === city.name;
        return (
          <group key={city.name} position={pos}>
            <mesh onClick={(e) => { e.stopPropagation(); onSelect(city); }}>
              <sphereGeometry args={[isSelected ? 0.045 : 0.025, 12, 12]} />
              <meshBasicMaterial color={isSelected ? '#f97316' : '#3b82f6'} />
            </mesh>
            {isSelected && (
              <Html distanceFactor={8} center style={{ pointerEvents: 'none' }}>
                <div className="bg-surface-1/95 backdrop-blur-sm border border-electric/30 rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  <p className="text-[10px] font-mono-code text-electric font-semibold">{city.name}</p>
                  <p className="text-[8px] text-muted-foreground">{city.lat.toFixed(4)}°, {city.lng.toFixed(4)}°</p>
                </div>
              </Html>
            )}
          </group>
        );
      })}
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
      targetPos.current = dir.multiplyScalar(4.5);
    }
  }, [target, zooming]);

  useFrame(() => {
    if (zooming && target) {
      camera.position.lerp(targetPos.current, 0.03);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// ─── Earth Globe mesh ───
function EarthGlobe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, earthTexture);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.5, 128, 128]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.85}
        metalness={0.1}
      />
    </mesh>
  );
}

// ─── Main component ───
interface GlobeSelectorProps {
  onLocationSelected: (location: { name: string; lat: number; lng: number }) => void;
}

export default function GlobeSelector({ onLocationSelected }: GlobeSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<typeof CITIES[0] | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [phase, setPhase] = useState<'browse' | 'confirming' | 'zooming'>('browse');

  const filteredCities = useMemo(() => {
    if (!search.trim()) return CITIES.slice(0, 8);
    const q = search.toLowerCase();
    return CITIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [search]);

  const handleSelectCity = useCallback((city: typeof CITIES[0]) => {
    setSelectedCity(city);
    setSearch(city.name);
    setShowDropdown(false);
    setPhase('confirming');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedCity) return;
    setPhase('zooming');
    setZooming(true);
    setTimeout(() => {
      onLocationSelected({ name: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng });
    }, 2000);
  }, [selectedCity, onLocationSelected]);

  const zoomTarget = useMemo(() => {
    if (!selectedCity) return null;
    return latLngToSphere(selectedCity.lat, selectedCity.lng, 2.5);
  }, [selectedCity]);

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col transition-opacity duration-700",
      phase === 'zooming' ? 'opacity-0' : 'opacity-100'
    )} style={{ background: 'radial-gradient(ellipse at center, hsl(220 15% 8%), hsl(240 10% 4%))' }}>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric to-safety flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-foreground font-mono-code">
              NEXUS GENESIS
            </h1>
            <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase">
              Selecione o Local do Show
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Buscar cidade ou local..."
            className="pl-9 pr-8 h-9 text-xs font-mono-code bg-surface-1/80 backdrop-blur border-border/50 focus:border-electric text-foreground"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-1/95 backdrop-blur-md border border-border/50 rounded-md shadow-2xl max-h-64 overflow-y-auto z-50">
              {filteredCities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleSelectCity(city)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-3/50 transition-colors",
                    selectedCity?.name === city.name && "bg-electric/10"
                  )}
                >
                  <MapPin className="w-3 h-3 text-electric shrink-0" />
                  <div>
                    <p className="text-xs text-foreground font-medium">{city.name}</p>
                    <p className="text-[9px] text-muted-foreground">{city.lat.toFixed(4)}°, {city.lng.toFixed(4)}°</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3D Globe */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 3, 5]} intensity={1.2} />
          <pointLight position={[-5, -3, -5]} intensity={0.3} color="#4488ff" />

          <EarthGlobe />
          <Atmosphere />
          <CityPins
            cities={CITIES}
            selectedCity={selectedCity?.name ?? null}
            onSelect={handleSelectCity}
          />
          <CameraZoomTo target={zoomTarget} zooming={zooming} />
          <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={3.5}
            maxDistance={15}
            autoRotate={!selectedCity}
            autoRotateSpeed={0.3}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>

        {/* Bottom info card */}
        {selectedCity && phase === 'confirming' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-1/90 backdrop-blur-xl border border-electric/20 rounded-xl px-6 py-4 flex items-center gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-electric/20 to-electric/5 flex items-center justify-center border border-electric/30">
              <MapPin className="w-5 h-5 text-electric" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedCity.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono-code">
                {selectedCity.lat.toFixed(6)}° {selectedCity.lat >= 0 ? 'N' : 'S'},{' '}
                {selectedCity.lng.toFixed(6)}° {selectedCity.lng >= 0 ? 'E' : 'W'}
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              className="ml-4 px-6 h-9 text-xs font-bold tracking-[0.15em] uppercase bg-gradient-to-r from-electric to-electric-glow hover:shadow-[0_0_20px_hsl(var(--electric)/0.4)] transition-all"
            >
              Confirmar Local
            </Button>
          </div>
        )}

        {/* Corner coordinates */}
        <div className="absolute bottom-4 right-4 text-[9px] font-mono-code text-muted-foreground/50">
          {selectedCity
            ? `${selectedCity.lat.toFixed(4)}°, ${selectedCity.lng.toFixed(4)}°`
            : 'Gire o globo para explorar'
          }
        </div>

        {/* Hint */}
        {!selectedCity && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-muted-foreground/60">
            <div className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center">
              <MapPin className="w-3 h-3" />
            </div>
            <p className="text-[10px] font-mono-code tracking-wider uppercase">
              Clique em um ponto ou busque uma cidade
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
