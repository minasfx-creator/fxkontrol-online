import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Speech bubble component ───
const SpeechBubble = ({ text, visible }: { text: string; visible: boolean }) => {
  if (!visible) return null;
  return (
    <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
      <div className="relative px-3 py-2 rounded-lg bg-black/85 border border-white/20 backdrop-blur-sm max-w-[180px] animate-scale-in">
        <p className="text-[11px] text-white font-medium leading-tight whitespace-pre-wrap">{text}</p>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-black/85" />
      </div>
    </Html>
  );
};

// ─── Drunk NPC ───
const DRUNK_DIALOGUES = [
  "Ei... essa luz é minha? 🍺",
  "Caaaadê o banheiro??",
  "Essa fumaça é... *hic* ...normal?",
  "Posso subir no palco? Só um pouquinho...",
  "Vocês são da banda?? 🎸",
  "Minha ex tá aqui... finge que sou da produção",
  "Esse fio tá ligado? *toca no fio*",
  "O DJ pediu pra eu avisar que... esqueci",
];

export function DrunkNPC() {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const [dialogue, setDialogue] = useState(DRUNK_DIALOGUES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const startAngle = useRef(Math.random() * Math.PI * 2);

  // Cycle dialogues
  useEffect(() => {
    const show = () => {
      setDialogue(DRUNK_DIALOGUES[Math.floor(Math.random() * DRUNK_DIALOGUES.length)]);
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 3000);
    };
    show();
    const interval = setInterval(show, 6000);
    return () => clearInterval(interval);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !bodyRef.current) return;
    const t = clock.elapsedTime;

    // Wobbly walk path — stumbling around the stage
    const angle = startAngle.current + t * 0.3;
    const radius = 5 + Math.sin(t * 0.7) * 2;
    groupRef.current.position.x = Math.cos(angle) * radius;
    groupRef.current.position.z = Math.sin(angle) * radius;
    groupRef.current.position.y = 0.3;

    // Face direction of movement (approximately)
    groupRef.current.rotation.y = -angle + Math.PI / 2;

    // Wobble body
    bodyRef.current.rotation.z = Math.sin(t * 2.5) * 0.15;
    bodyRef.current.rotation.x = Math.sin(t * 1.8) * 0.08;
    bodyRef.current.position.y = Math.abs(Math.sin(t * 3)) * 0.05;
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Legs — jeans */}
        <mesh position={[-0.1, 0.3, 0]}>
          <boxGeometry args={[0.13, 0.6, 0.13]} />
          <meshStandardMaterial color="#2a3a5c" />
        </mesh>
        <mesh position={[0.1, 0.3, 0]}>
          <boxGeometry args={[0.13, 0.6, 0.13]} />
          <meshStandardMaterial color="#2a3a5c" />
        </mesh>
        {/* Torso — hawaiian shirt */}
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[0.38, 0.5, 0.22]} />
          <meshStandardMaterial color="#e84393" />
        </mesh>
        {/* Flower pattern on shirt */}
        <mesh position={[0.1, 0.9, 0.115]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="#fdcb6e" emissive="#fdcb6e" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[-0.08, 0.78, 0.115]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#55efc4" emissive="#55efc4" emissiveIntensity={0.3} />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.26, 0.85, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#dda68a" />
        </mesh>
        <mesh position={[0.26, 0.75, 0.08]} rotation={[0.5, 0, -0.2]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#dda68a" />
        </mesh>
        {/* Beer bottle in hand */}
        <mesh position={[0.3, 0.55, 0.12]} rotation={[0.3, 0, -0.2]}>
          <cylinderGeometry args={[0.025, 0.03, 0.2, 8]} />
          <meshStandardMaterial color="#2d5016" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Head — red face */}
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="#e8a090" />
        </mesh>
        {/* Red nose */}
        <mesh position={[0, 1.22, 0.14]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#e74c3c" emissive="#c0392b" emissiveIntensity={0.4} />
        </mesh>
        {/* Sunglasses (crooked) */}
        <mesh position={[0, 1.28, 0.13]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.22, 0.05, 0.02]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Shoes — flip flops */}
        <mesh position={[-0.1, 0.02, 0.03]}>
          <boxGeometry args={[0.12, 0.04, 0.2]} />
          <meshStandardMaterial color="#e17055" />
        </mesh>
        <mesh position={[0.1, 0.02, 0.03]}>
          <boxGeometry args={[0.12, 0.04, 0.2]} />
          <meshStandardMaterial color="#e17055" />
        </mesh>
      </group>
      {/* Speech bubble */}
      <group position={[0, 1.7, 0]}>
        <SpeechBubble text={dialogue} visible={showBubble} />
      </group>
    </group>
  );
}

// ─── Late Producer NPC ───
const PRODUCER_DIALOGUES = [
  "Desculpa o atraso! Mudou TUDO. 📋",
  "O cliente quer mais sparkular. MAIS.",
  "Pode trocar tudo pra azul? Agora.",
  "Esqueci o rider... improvisa aí! 😅",
  "A banda cancelou. Bota DJ. Bota!",
  "Precisa de mais fog. O TRIPLO.",
  "Muda o setlist. De novo. Sim, agora.",
  "O sponsor quer o logo em chamas. Literal.",
];

export function ProducerNPC() {
  const groupRef = useRef<THREE.Group>(null);
  const [dialogue, setDialogue] = useState(PRODUCER_DIALOGUES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Appears after 8 seconds, disappears and reappears
    const timer = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const show = () => {
      setDialogue(PRODUCER_DIALOGUES[Math.floor(Math.random() * PRODUCER_DIALOGUES.length)]);
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 4000);
    };
    show();
    const interval = setInterval(show, 7000);
    return () => clearInterval(interval);
  }, [visible]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return;
    const t = clock.elapsedTime;
    // Paces back and forth nervously
    groupRef.current.position.x = -6 + Math.sin(t * 1.2) * 2;
    groupRef.current.position.z = 4;
    groupRef.current.position.y = 0.3;
    groupRef.current.rotation.y = Math.sin(t * 1.2) > 0 ? Math.PI * 0.3 : -Math.PI * 0.3;
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {/* Legs — dress pants */}
      <mesh position={[-0.1, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.1, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Torso — wrinkled polo */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.36, 0.5, 0.22]} />
        <meshStandardMaterial color="#636e72" />
      </mesh>
      {/* Collar */}
      <mesh position={[0, 1.08, 0.05]}>
        <boxGeometry args={[0.2, 0.04, 0.12]} />
        <meshStandardMaterial color="#dfe6e9" />
      </mesh>
      {/* Arms — gesticulating */}
      <mesh position={[-0.26, 0.9, 0.1]} rotation={[-0.6, 0, 0.4]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#dda68a" />
      </mesh>
      <mesh position={[0.26, 0.95, 0.08]} rotation={[-0.8, 0, -0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#dda68a" />
      </mesh>
      {/* Phone in hand */}
      <mesh position={[0.28, 1.15, 0.15]} rotation={[-0.5, 0, -0.3]}>
        <boxGeometry args={[0.06, 0.1, 0.01]} />
        <meshStandardMaterial color="#2d3436" emissive="#74b9ff" emissiveIntensity={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#dda68a" />
      </mesh>
      {/* Messy hair */}
      <mesh position={[0, 1.38, -0.02]}>
        <sphereGeometry args={[0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Headset */}
      <mesh position={[0.15, 1.28, 0.04]}>
        <torusGeometry args={[0.03, 0.01, 8, 12, Math.PI]} />
        <meshStandardMaterial color="#111" metalness={0.8} />
      </mesh>
      {/* Dress shoes */}
      <mesh position={[-0.1, 0.02, 0.02]}>
        <boxGeometry args={[0.13, 0.06, 0.2]} />
        <meshStandardMaterial color="#2d3436" metalness={0.4} />
      </mesh>
      <mesh position={[0.1, 0.02, 0.02]}>
        <boxGeometry args={[0.13, 0.06, 0.2]} />
        <meshStandardMaterial color="#2d3436" metalness={0.4} />
      </mesh>
      {/* Badge / lanyard */}
      <mesh position={[0, 0.7, 0.12]}>
        <boxGeometry args={[0.08, 0.12, 0.01]} />
        <meshStandardMaterial color="#dfe6e9" />
      </mesh>
      <mesh position={[0, 0.82, 0.12]}>
        <cylinderGeometry args={[0.005, 0.005, 0.2, 4]} />
        <meshStandardMaterial color="#e17055" />
      </mesh>

      <group position={[0, 1.7, 0]}>
        <SpeechBubble text={dialogue} visible={showBubble} />
      </group>
    </group>
  );
}

// ─── Indecisive Client NPC ───
const CLIENT_DIALOGUES = [
  "Na verdade... muda tudo pra vermelho. 🤔",
  "Pode colocar mais brilho? E menos fumaça.",
  "Meu sobrinho acha que precisa de laser.",
  "Vi no Pinterest uma coisa diferente...",
  "Isso tá parecendo o casamento da vizinha 😤",
  "E se a gente fizesse ao contrário?",
  "Minha sogra não vai gostar dessa cor.",
  "Tira o cryo. Bota o cryo. Tira de novo.",
];

export function ClientNPC() {
  const groupRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Mesh>(null);
  const [dialogue, setDialogue] = useState(CLIENT_DIALOGUES[0]);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    const show = () => {
      setDialogue(CLIENT_DIALOGUES[Math.floor(Math.random() * CLIENT_DIALOGUES.length)]);
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), 4500);
    };
    const timer = setTimeout(show, 4000);
    const interval = setInterval(show, 8000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    // Stands off to the side, shifting weight
    groupRef.current.position.set(7, 0.3, -2);
    groupRef.current.rotation.y = -Math.PI * 0.4 + Math.sin(t * 0.5) * 0.1;

    // Pointing arm gesture
    if (armRef.current) {
      armRef.current.rotation.x = -0.8 + Math.sin(t * 2) * 0.3;
      armRef.current.rotation.z = -0.5 + Math.sin(t * 1.5) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Legs — fancy pants */}
      <mesh position={[-0.1, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
        <meshStandardMaterial color="#b2bec3" />
      </mesh>
      <mesh position={[0.1, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
        <meshStandardMaterial color="#b2bec3" />
      </mesh>
      {/* Torso — blazer */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.38, 0.5, 0.24]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Shirt underneath */}
      <mesh position={[0, 0.85, 0.125]}>
        <boxGeometry args={[0.15, 0.45, 0.005]} />
        <meshStandardMaterial color="#dfe6e9" />
      </mesh>
      {/* Left arm (pointing) */}
      <mesh ref={armRef} position={[0.28, 0.95, 0.08]}>
        <boxGeometry args={[0.1, 0.45, 0.1]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Right arm (crossed) */}
      <mesh position={[-0.26, 0.8, 0.1]} rotation={[-0.3, 0, 0.5]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#dda68a" />
      </mesh>
      {/* Styled hair */}
      <mesh position={[0, 1.38, -0.02]}>
        <boxGeometry args={[0.22, 0.08, 0.2]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Glasses */}
      <mesh position={[0, 1.28, 0.13]}>
        <boxGeometry args={[0.24, 0.04, 0.02]} />
        <meshStandardMaterial color="#b2bec3" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Fancy shoes */}
      <mesh position={[-0.1, 0.02, 0.03]}>
        <boxGeometry args={[0.12, 0.05, 0.22]} />
        <meshStandardMaterial color="#6c5ce7" metalness={0.3} />
      </mesh>
      <mesh position={[0.1, 0.02, 0.03]}>
        <boxGeometry args={[0.12, 0.05, 0.22]} />
        <meshStandardMaterial color="#6c5ce7" metalness={0.3} />
      </mesh>
      {/* Watch */}
      <mesh position={[-0.2, 0.65, 0.08]}>
        <torusGeometry args={[0.025, 0.008, 8, 16]} />
        <meshStandardMaterial color="#fdcb6e" metalness={0.9} roughness={0.1} />
      </mesh>

      <group position={[0, 1.7, 0]}>
        <SpeechBubble text={dialogue} visible={showBubble} />
      </group>
    </group>
  );
}
