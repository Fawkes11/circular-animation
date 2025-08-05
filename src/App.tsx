import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, SoftShadows } from '@react-three/drei'
import { useState, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useControls } from 'leva'


type ModelProps = {
  meshes: THREE.Mesh[]
  activeIndex: number | null
}

const BASE_COLOR = new THREE.Color('#fdfcf7')
const ACTIVE_COLOR = new THREE.Color('#6D00A3')
const TRAIL_LENGTH = 5

function Model({ meshes, activeIndex }: ModelProps) {
  const [intensities, setIntensities] = useState<number[]>(
    Array(meshes.length).fill(0)
  )

  useFrame(() => {
    const newIntensities = [...intensities]

    for (let i = 0; i < meshes.length; i++) {

      const distance = activeIndex !== null
        ? Math.min(
          Math.abs(activeIndex - i),
          meshes.length - Math.abs(activeIndex - i)
        )
        : Infinity

      const insideTrail = distance < TRAIL_LENGTH

      const targetIntensity = insideTrail ? 1 - distance / TRAIL_LENGTH : 0
      newIntensities[i] = THREE.MathUtils.lerp(
        intensities[i],
        targetIntensity,
        0.1
      )

      const color = BASE_COLOR.clone().lerp(ACTIVE_COLOR, newIntensities[i])

      const mesh = meshes[i]
      if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.copy(color)
      }

      // ✨ Escalado senoidal
      const amplitude = 0.065
      const scaleFactor =
        insideTrail
          ? 1 + Math.sin(targetIntensity * Math.PI / 2) * amplitude
          : 1

      mesh.scale.lerp(new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor), 0.075)
    }

    setIntensities(newIntensities)
  })

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} castShadow />
      ))}
    </group>
  )
}




type BubbleProps = {
  radius: number
  speed: number
  basePosition: [number, number, number]
  meshes: THREE.Mesh[]
  setActiveIndex: (index: number | null) => void
}

function Bubble({
  radius,
  speed,
  basePosition,
  meshes,
  setActiveIndex,
}: BubbleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const angleRef = useRef(0)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useFrame((_, delta) => {
    angleRef.current -= delta * speed

    const x = basePosition[0] + radius * Math.cos(angleRef.current)
    const z = basePosition[2] + radius * Math.sin(angleRef.current)
    const y = basePosition[1]

    const bubblePos = new THREE.Vector3(x, y, z)

    if (meshRef.current) {
      meshRef.current.position.set(x, y, z)
      meshRef.current.rotation.y += 0.01

      raycaster.set(bubblePos, new THREE.Vector3(0, -1, 0))
      const intersects = raycaster.intersectObjects(meshes, false)
      if (intersects.length > 0) {
        const index = meshes.findIndex(
          (m) => m.uuid === intersects[0].object.uuid
        )
        setActiveIndex(index)
      } else {
        setActiveIndex(null)
      }
    }
  })

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[0.075, 64, 64]} />
      <meshPhysicalMaterial
        color="#fdfcf7"
        roughness={0.2}
        transmission={1}
        thickness={0.5}
        ior={1.3}
        reflectivity={0.4}
        transparent
      />
    </mesh>
  )
}

type PlaneProps = {
  width?: number
  height?: number
  color?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  receiveShadow?: boolean
}

const Plane: React.FC<PlaneProps> = ({
  width = 10,
  height = 10,
  color = '#ffffff',
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0], // por defecto plano horizontal
  receiveShadow = true,
}) => {
  const ref = useRef<THREE.Mesh>(null)

  return (
    <mesh
      ref={ref}
      position={position}
      rotation={rotation}
      receiveShadow={receiveShadow}
    >
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function App() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const meshesRef = useRef<THREE.Mesh[]>([])

  const { radius, speed } = useControls({
    radius: { value: 1.6, min: 1, max: 10, step: 0.1 },
    speed: { value: 1, min: 0.1, max: 5 },
  })

  const { scene } = useGLTF(import.meta.env.BASE_URL + 'assets/base.glb')

  useMemo(() => {
    meshesRef.current = []

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name.startsWith('leaf')) {
        const mesh = child as THREE.Mesh
        const clone = mesh.clone()
        clone.material = (mesh.material as THREE.Material).clone()
        meshesRef.current.push(clone)
      }
    })

    // ✅ Ordenamos los pétalos por su nombre (leaf.000 → leaf.031)
    meshesRef.current.sort((a, b) => {
      const aIndex = parseInt(a.name.split('.')[1])
      const bIndex = parseInt(b.name.split('.')[1])
      return aIndex - bIndex
    })
  }, [scene])




  return (
    <div className="w-full h-screen flex items-center justify-center bg-black">
      <Canvas shadows camera={{ position: [0, 7.5, 0], fov: 50 }}>
        <SoftShadows samples={16} size={8} focus={0.2} />
        <ambientLight intensity={0.01} />
        <directionalLight
          position={[-2, 10, 2]}
          castShadow
          intensity={1}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />

        <Model
          meshes={meshesRef.current}
          activeIndex={activeIndex}
        />
        <Plane
          color="#cccccc"
          position={[0, -2, 0]}
          width={30}
          height={20}
        />
        <Bubble
          radius={radius}
          speed={speed}
          basePosition={[0, 0.75, 0]}
          meshes={meshesRef.current}
          setActiveIndex={setActiveIndex}
        />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default App

