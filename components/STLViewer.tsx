'use client'

import React, { Suspense, useState, useEffect, useRef, Component, ErrorInfo } from 'react'
import { Canvas, useLoader, useFrame } from '@react-three/fiber'
import { OrbitControls, Center, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

interface STLMeshProps {
  url: string
  wireframe: boolean
}

function STLMesh({ url, wireframe }: STLMeshProps) {
  const geometry = useLoader(STLLoader, url)

  useEffect(() => {
    geometry.computeVertexNormals()
  }, [geometry])

  return (
    <Center>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#c8bfb0"
          metalness={0.1}
          roughness={0.7}
          wireframe={wireframe}
        />
      </mesh>
    </Center>
  )
}

function LoadingSpinner() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 2
    }
  })
  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[0.5, 0.1, 16, 32]} />
      <meshStandardMaterial color="#4a90d9" />
    </mesh>
  )
}

function LoadingScene() {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <LoadingSpinner />
    </Canvas>
  )
}

// Error boundary class component
interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

class STLErrorBoundary extends Component<
  { children: React.ReactNode; onError: (msg: string) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onError: (msg: string) => void }) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error.message)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

interface STLViewerProps {
  file: File | null
  demoPath?: string | null
}

export default function STLViewer({ file, demoPath }: STLViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Cleanup previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    if (file) {
      setLoadError(null)
      setIsLoading(true)
      const objectUrl = URL.createObjectURL(file)
      objectUrlRef.current = objectUrl
      setUrl(objectUrl)
    } else if (demoPath) {
      setLoadError(null)
      setIsLoading(true)
      setUrl(demoPath)
    } else {
      setUrl(null)
      setIsLoading(false)
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [file, demoPath])

  if (!url) {
    return (
      <div className="w-full h-full min-h-[400px] bg-[#0a1929] rounded-xl flex items-center justify-center">
        <div className="text-center text-cream-muted">
          <div className="w-16 h-16 border-2 border-dashed border-border-col rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⬡</span>
          </div>
          <p className="text-sm">3D model will appear here</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="w-full h-full min-h-[400px] bg-[#0a1929] rounded-xl flex items-center justify-center">
        <div className="text-center">
          <p className="text-status-red font-semibold mb-2">Failed to load STL file</p>
          <p className="text-cream-muted text-sm">{loadError}</p>
          <p className="text-cream-muted text-xs mt-2">Please try another file.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#0a1929] rounded-xl overflow-hidden">
      {/* Hint overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <span className="text-xs text-cream-muted/70 bg-navy/60 backdrop-blur-sm px-3 py-1 rounded-full">
          Drag to rotate · Scroll to zoom · Right-click to pan
        </span>
      </div>

      {/* Wireframe toggle */}
      <button
        onClick={() => setWireframe((w) => !w)}
        className="absolute bottom-3 left-3 z-10 px-3 py-1.5 text-xs font-medium bg-navy-elevated border border-border-col text-cream-muted rounded-lg hover:text-cream hover:border-accent transition-colors"
      >
        Wireframe {wireframe ? 'ON' : 'OFF'}
      </button>

      <STLErrorBoundary onError={(msg) => setLoadError(msg)}>
        <Canvas
          camera={{ position: [0, 0, 15], fov: 50 }}
          gl={{ antialias: true }}
          onCreated={({ scene }) => {
            scene.background = new THREE.Color('#0a1929')
          }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={1.2}
            color="#fff8f0"
          />
          <pointLight position={[-5, -5, -5]} intensity={0.3} />

          <Suspense
            fallback={
              <>
                <LoadingSpinner />
              </>
            }
          >
            <STLMesh
              url={url}
              wireframe={wireframe}
            />
          </Suspense>

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={false}
          />

          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#ef4444', '#22c55e', '#4a90d9']}
              labelColor="white"
            />
          </GizmoHelper>
        </Canvas>
      </STLErrorBoundary>
    </div>
  )
}
