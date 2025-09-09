import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default function Viewer({ glbUrl, isLoading, error }) {
  const mountRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const controlsRef = useRef(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showDownloadButton, setShowDownloadButton] = useState(false)

  const handleDownload = () => {
    if (glbUrl) {
      const link = document.createElement('a')
      link.href = glbUrl
      link.download = 'floorplan-3d-model.glb'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width/height, 0.1, 1000)
    camera.position.set(10, 8, 10)

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Enhanced lighting setup for better 3D visualization
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3)
    scene.add(ambientLight)

    // Main directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(15, 25, 15)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 4096
    dirLight.shadow.mapSize.height = 4096
    dirLight.shadow.camera.near = 0.1
    dirLight.shadow.camera.far = 100
    dirLight.shadow.camera.left = -30
    dirLight.shadow.camera.right = 30
    dirLight.shadow.camera.top = 30
    dirLight.shadow.camera.bottom = -30
    dirLight.shadow.bias = -0.0001
    scene.add(dirLight)

    // Hemisphere light for natural sky/ground lighting
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.4)
    hemiLight.position.set(0, 20, 0)
    scene.add(hemiLight)

    // Fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
    fillLight.position.set(-15, 15, -15)
    scene.add(fillLight)

    // Rim light for better edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.1)
    rimLight.position.set(0, 10, -20)
    scene.add(rimLight)

    // Enhanced grid with better visibility
    const grid = new THREE.GridHelper(50, 50, 0x666666, 0x999999)
    grid.position.y = -0.01
    scene.add(grid)

    // Add axes helper for better orientation
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    // Add a subtle background gradient
    const skyGeometry = new THREE.SphereGeometry(100, 32, 15)
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3
    })
    const sky = new THREE.Mesh(skyGeometry, skyMaterial)
    scene.add(sky)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = true
    controls.enablePan = true
    controls.maxPolarAngle = Math.PI / 2
    controls.minDistance = 2
    controls.maxDistance = 50
    controlsRef.current = controls

    // Load model if URL is provided
    if (glbUrl) {
      const loader = new GLTFLoader()
      
      loader.load(
        glbUrl,
        (gltf) => {
          const model = gltf.scene
          
          // Enable shadows and enhance materials for all meshes
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
              
              // Enhance material properties based on geometry type
              if (child.material) {
                // Different materials for different parts
                if (child.name.includes('floor')) {
                  // Floor material - more matte
                  child.material.color.setHex(0xf5f5f5)
                  child.material.metalness = 0.0
                  child.material.roughness = 0.9
                } else {
                  // Wall material - slightly more reflective
                  child.material.color.setHex(0xe8e8e8)
                  child.material.metalness = 0.05
                  child.material.roughness = 0.7
                }
                
                // Ensure material is properly configured
                child.material.needsUpdate = true
              }
            }
          })

          // Center and scale the model
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          
          // Only scale if the model is too large or too small
          if (maxDim > 20 || maxDim < 1) {
            const scale = 10 / maxDim
            model.scale.setScalar(scale)
            model.position.sub(center.multiplyScalar(scale))
          } else {
            model.position.sub(center)
          }
          
          model.position.y = 0

        scene.add(model)
          
          // Adjust camera to fit the model
          const distance = Math.max(size.x, size.y, size.z) * 1.5
          camera.position.set(distance, distance * 0.6, distance)
          controls.target.copy(model.position)
          controls.update()
          
          console.log(`Model loaded: ${model.children.length} children, bounds:`, {
            center: center,
            size: size,
            maxDim: maxDim
          })
          
          setLoadingProgress(100)
          setShowDownloadButton(true)
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100
          setLoadingProgress(percent)
        },
        (error) => {
          console.error('Error loading GLB:', error)
          setLoadingProgress(0)
        }
      )
    }

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w/h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      if (rendererRef.current && mount.contains(rendererRef.current.domElement)) {
        mount.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
      }
    }
  }, [glbUrl])

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        color: '#ef4444',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <div>Error loading 3D model</div>
          <div style={{ fontSize: '14px', marginTop: '5px', opacity: 0.7 }}>{error}</div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
          <div>Loading 3D model...</div>
          <div style={{ 
            width: '200px', 
            height: '4px', 
            backgroundColor: '#e2e8f0', 
            borderRadius: '2px', 
            margin: '10px auto',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${loadingProgress}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '14px' }}>{Math.round(loadingProgress)}%</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {showDownloadButton && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}>
          <button
            onClick={handleDownload}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              opacity: 0.9
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = '1'
              e.target.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '0.9'
              e.target.style.transform = 'translateY(0)'
            }}
          >
            <span>📥</span>
            Download GLB
          </button>
        </div>
      )}
    </div>
  )
}
