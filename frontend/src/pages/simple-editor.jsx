import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Material assignment function with proper thresholds
function assignMaterial(mesh, boundingBox, wallColor = "#FFFFFF", forceWallMode = false) {
  const size = boundingBox.getSize(new THREE.Vector3());
  const center = boundingBox.getCenter(new THREE.Vector3());
  const name = mesh.name.toLowerCase();
  
  // Thresholds for detection (adjust based on your model units)
  const FLOOR_HEIGHT_THRESHOLD = 0.3;  // Max height for floor detection (reduced)
  const FLOOR_AREA_THRESHOLD = 2.0;    // Min area (width * depth) for floor (reduced)
  const WALL_HEIGHT_THRESHOLD = 0.8;   // Min height for wall detection (reduced)
  const WALL_THICKNESS_THRESHOLD = 1.0; // Max thickness for wall detection (increased)
  
  console.log(`Material assignment for ${mesh.name}:`);
  console.log(`  Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
  console.log(`  Center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
  
  let materialType = 'neutral';
  let isFloor = false;
  let isWall = false;
  
  // 0. Force wall mode (for testing) - HIGHEST PRIORITY
  if (forceWallMode) {
    // In force mode, treat everything as wall EXCEPT if it's clearly a floor by name
    if (name === 'floor' || name.includes('ground') || name.includes('base') || name.includes('plane')) {
      isFloor = true;
      materialType = 'floor';
      console.log(`  → FORCED mode: Detected as FLOOR by name (${name})`);
    } else {
      isWall = true;
      materialType = 'wall';
      console.log(`  → FORCED to WALL mode - OVERRIDING all other detection`);
    }
  } else {
    // 1. Name-based detection (only when not in force mode)
    if (name === 'floor' || name.includes('ground') || name.includes('base') || name.includes('plane')) {
      isFloor = true;
      materialType = 'floor';
      console.log(`  → Detected as FLOOR by name`);
    } else if (name.includes('wall') || name.includes('structure') || name.includes('building')) {
      isWall = true;
      materialType = 'wall';
      console.log(`  → Detected as WALL by name`);
    }
  }
  
  // 2. Position-based detection (only when not in force mode)
  if (!forceWallMode && !isFloor && !isWall) {
    if (center.y < 0.1) {
      isFloor = true;
      materialType = 'floor';
      console.log(`  → Detected as FLOOR by position (Y < 0.1)`);
    } else if (center.y > 0.5) {
      isWall = true;
      materialType = 'wall';
      console.log(`  → Detected as WALL by position (Y > 0.5)`);
    }
  }
  
  // 3. Geometry-based detection (only when not in force mode)
  if (!forceWallMode && !isFloor && !isWall) {
    const area = size.x * size.z;
    const isThinVertically = size.y < FLOOR_HEIGHT_THRESHOLD;
    const hasLargeFootprint = area > FLOOR_AREA_THRESHOLD;
    const isTall = size.y > WALL_HEIGHT_THRESHOLD;
    const isThin = size.x < WALL_THICKNESS_THRESHOLD || size.z < WALL_THICKNESS_THRESHOLD;
    
    console.log(`  → Geometry analysis: area=${area.toFixed(2)}, isThinVertically=${isThinVertically}, hasLargeFootprint=${hasLargeFootprint}, isTall=${isTall}, isThin=${isThin}`);
    
    if (isThinVertically && hasLargeFootprint) {
      isFloor = true;
      materialType = 'floor';
      console.log(`  → Detected as FLOOR by geometry (thin & wide: ${area.toFixed(2)} area)`);
    } else if (isTall && isThin) {
      isWall = true;
      materialType = 'wall';
      console.log(`  → Detected as WALL by geometry (tall & thin)`);
    } else {
      // For most architectural elements, default to wall unless clearly floor
      if (size.y > 0.5) { // If it has some height, treat as wall
        isWall = true;
        materialType = 'wall';
        console.log(`  → Defaulted to WALL by geometry (has height: ${size.y.toFixed(2)})`);
      } else {
        isFloor = true;
        materialType = 'floor';
        console.log(`  → Defaulted to FLOOR by geometry (low height: ${size.y.toFixed(2)})`);
      }
    }
  }
  
  // Apply material based on type
  let material;
  console.log(materialType,"materialType")
  switch (materialType) {
      case 'floor':
        material = new THREE.MeshStandardMaterial({
          color: 0x8B5A2B, // Wooden brown
          roughness: 0.6,  // Wood-like roughness
          metalness: 0.0,  // Non-metallic
          side: THREE.DoubleSide // Ensure both sides are visible
        });
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      console.log(`  ✅ Applied WOODEN FLOOR material`);
      break;
      
    case 'wall':
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wallColor), // Convert hex string to Three.js Color
        roughness: 0.2,  // Very smooth surface
        metalness: 0.0,  // Non-metallic
        side: THREE.DoubleSide // Ensure both sides are visible
      });
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      console.log(`  ✅ Applied WALL material with color: ${wallColor}`);
      break;
      
    default:
      material = new THREE.MeshStandardMaterial({
        color: 0xE0E0E0, // Light gray
        roughness: 0.5,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      console.log(`  ✅ Applied NEUTRAL material`);
  }
  
  mesh.material = material;
  mesh.material.needsUpdate = true;
  
  return materialType;
}

function FloorGLB({ url, wallColor, forceWallMode }) {
  const { scene } = useGLTF(url);
  const [clonedScene, setClonedScene] = useState(null);
  
  // Process materials when scene loads or wallColor changes
  useEffect(() => {
    if (!scene) return;
    
    const processScene = () => {
      // Clone the scene to modify materials
      const newClonedScene = scene.clone();
      
      console.log('🔧 Processing 3D model for material assignment...');
      console.log('🎨 Wall color:', wallColor);
      
      newClonedScene.traverse((child) => {
        if (child.isMesh) {
          console.log(`\n📦 Processing mesh: "${child.name}"`);
          
          // Ensure geometry has valid normals
          if (child.geometry) {
            if (!child.geometry.attributes.normal || child.geometry.attributes.normal.count === 0) {
              console.log(`  🔧 Computing vertex normals for ${child.name}`);
              child.geometry.computeVertexNormals();
            }
            
            // Ensure geometry is not disposed
            if (child.geometry.disposed) {
              console.warn(`  ⚠️ Geometry is disposed for ${child.name}, skipping`);
              return;
            }
          }
          
          // Compute bounding box for material assignment
          let boundingBox;
          try {
            child.geometry.computeBoundingBox();
            boundingBox = child.geometry.boundingBox.clone();
            
            // Transform bounding box to world space
            child.updateMatrixWorld();
            boundingBox.applyMatrix4(child.matrixWorld);
            
            // Assign material based on geometry analysis
            const materialType = assignMaterial(child, boundingBox, wallColor, forceWallMode);
            
          } catch (error) {
            console.error(`  ❌ Error processing ${child.name}:`, error);
            
            // Fallback to neutral material
            child.material = new THREE.MeshStandardMaterial({
              color: 0xE0E0E0,
              roughness: 0.5,
              metalness: 0.0,
              side: THREE.DoubleSide
            });
            child.receiveShadow = true;
            child.castShadow = true;
          }
        }
      });
      
      console.log('✅ Material assignment complete!');
      setClonedScene(newClonedScene);
    };
    
    processScene();
  }, [scene, wallColor, forceWallMode]);
  
  if (!clonedScene) {
    return null; // Loading state
  }
  
  return <primitive object={clonedScene} />;
}

function Furniture({ id, url, position, rotation, scale, color, onSelect, isSelected }) {
  const { scene } = useGLTF(url);
  
  // Clone the scene to modify materials
  const clonedScene = scene.clone();
  clonedScene.traverse((child) => {
    if (child.isMesh) {
      // Create a new material with neutral light gray base
      child.material = child.material.clone();
      
      // Set a neutral light gray base color for better visibility
      child.material.color.setHex(0xF5F5F5); // Light gray base
      child.material.needsUpdate = true;
      
      // Apply the user-selected color on top
      child.material.color.setHex(color);
    }
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive
        object={clonedScene}
        onPointerDown={(e) => { 
          e.stopPropagation(); 
          onSelect(id); 
        }}
      />
      {isSelected && (
        <mesh>
          <boxGeometry args={[2, 0.1, 2]} />
          <meshBasicMaterial color="yellow" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

export default function SimpleEditor() {
  const [placed, setPlaced] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [placingType, setPlacingType] = useState(null); // No default selection
  const [floorUrl, setFloorUrl] = useState("/floor.glb");
  const [isLoadingFloor, setIsLoadingFloor] = useState(false);
  const [uploadedFloor, setUploadedFloor] = useState(null);
  
  // Wall color state
  const [wallColor, setWallColor] = useState("#FFFFFF");
  const [showWallColorPicker, setShowWallColorPicker] = useState(false);
  const [forceWallMode, setForceWallMode] = useState(false);
  
  // Predefined wall colors
  const wallColors = [
    { name: "White", value: "#FFFFFF" },
    { name: "Off-White", value: "#F5F5F5" },
    { name: "Light Gray", value: "#E0E0E0" },
    { name: "Light Blue", value: "#E3F2FD" },
    { name: "Light Green", value: "#E8F5E8" },
    { name: "Light Pink", value: "#FCE4EC" },
    { name: "Light Yellow", value: "#FFFDE7" },
    { name: "Cream", value: "#FFF8DC" },
    { name: "Beige", value: "#F5F5DC" },
    { name: "Light Purple", value: "#F3E5F5" }
  ];

  useEffect(() => {
    const data = localStorage.getItem("layout");
    if (data) {
      try {
        setPlaced(JSON.parse(data));
      } catch (e) {
        console.error("Failed to load layout:", e);
      }
    }
  }, []);

  const addFurnitureAt = (point) => {
    // Only place furniture if a type is selected
    if (!placingType) {
      return; // Silently ignore clicks when no type is selected
    }
    
    const id = Date.now();
    const newItem = {
      id,
      type: placingType,
      position: [point.x, 0.5, point.z], // Raise furniture above floor (Y = 0.5)
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: 0xF5F5F5 // Light gray color
    };
    setPlaced((p) => [...p, newItem]);
    setSelectedId(id);
    
    // Clear the placing type after placing one item to stop auto-placement
    setPlacingType(null);
  };

  const updateSelected = (changes) => {
    setPlaced((p) => p.map((item) =>
      item.id === selectedId ? { ...item, ...changes } : item
    ));
  };

  const deleteSelected = () => {
    setPlaced((p) => p.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  };

  const saveLayout = () => {
    localStorage.setItem("layout", JSON.stringify(placed));
    // Show success message in UI instead of alert
    const message = document.createElement('div');
    message.textContent = 'Layout saved successfully!';
    message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(message);
    setTimeout(() => document.body.removeChild(message), 3000);
  };

  const loadLayout = () => {
    const data = localStorage.getItem("layout");
    if (data) {
      try {
        setPlaced(JSON.parse(data));
        // Show success message in UI instead of alert
        const message = document.createElement('div');
        message.textContent = 'Layout loaded successfully!';
        message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #17a2b8; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(message);
        setTimeout(() => document.body.removeChild(message), 3000);
      } catch (e) {
        const message = document.createElement('div');
        message.textContent = 'Failed to load layout';
        message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(message);
        setTimeout(() => document.body.removeChild(message), 3000);
      }
    } else {
      const message = document.createElement('div');
      message.textContent = 'No saved layout found';
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ffc107; color: black; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
      document.body.appendChild(message);
      setTimeout(() => document.body.removeChild(message), 3000);
    }
  };

  const clearLayout = () => {
    setPlaced([]);
    setSelectedId(null);
    localStorage.removeItem("layout");
    // Show success message in UI instead of alert
    const message = document.createElement('div');
    message.textContent = 'Layout cleared successfully!';
    message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ffc107; color: black; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
    document.body.appendChild(message);
    setTimeout(() => document.body.removeChild(message), 3000);
  };

  const handleFloorUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      const message = document.createElement('div');
      message.textContent = `File too large. Maximum size is 100MB, got ${(file.size / (1024*1024)).toFixed(1)}MB`;
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
      document.body.appendChild(message);
      setTimeout(() => document.body.removeChild(message), 5000);
      return;
    }

    setIsLoadingFloor(true);
    
    // Show file size info
    const fileSizeMB = (file.size / (1024*1024)).toFixed(1);
    console.log(`Uploading file: ${file.name} (${fileSizeMB}MB)`);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine file type and endpoint
      const fileType = file.name.toLowerCase().split('.').pop();
      let endpoint = '';
      
      if (['jpg', 'jpeg'].includes(fileType)) {
        endpoint = 'http://localhost:8000/convert/jpg-to-glb';
      } else if (fileType === 'dxf') {
        endpoint = 'http://localhost:8000/convert/cad-to-glb';
      } else {
        // Show error message in UI instead of alert
        const message = document.createElement('div');
        message.textContent = 'Unsupported file type. Please upload JPG or DXF files.';
        message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(message);
        setTimeout(() => document.body.removeChild(message), 3000);
        setIsLoadingFloor(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setFloorUrl(url);
      setUploadedFloor(file.name);
      
      // Clear existing furniture when loading new floor
      setPlaced([]);
      setSelectedId(null);
      
      // Show success message in UI instead of alert
      const message = document.createElement('div');
      message.textContent = `Floor plan "${file.name}" loaded successfully!`;
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
      document.body.appendChild(message);
      setTimeout(() => document.body.removeChild(message), 3000);
    } catch (error) {
      console.error('Error uploading floor:', error);
      // Show error message in UI instead of alert
      const message = document.createElement('div');
      message.textContent = 'Failed to process floor plan. Please try again.';
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
      document.body.appendChild(message);
      setTimeout(() => document.body.removeChild(message), 3000);
    } finally {
      setIsLoadingFloor(false);
    }
  };

  const resetToDefaultFloor = () => {
    setFloorUrl("/floor.glb");
    setUploadedFloor(null);
    setPlaced([]);
    setSelectedId(null);
  };

  const changeColor = (color) => {
    updateSelected({ color: parseInt(color.replace('#', '0x')) });
  };

  const predefinedColors = [
    { name: "Wood Brown", value: "#8B4513" },
    { name: "Dark Brown", value: "#654321" },
    { name: "Light Brown", value: "#D2B48C" },
    { name: "Black", value: "#000000" },
    { name: "Charcoal", value: "#36454F" },
    { name: "Navy Blue", value: "#000080" },
    { name: "Forest Green", value: "#228B22" },
    { name: "Burgundy", value: "#800020" },
    { name: "Light Blue", value: "#E3F2FD" },
    { name: "Light Green", value: "#E8F5E8" },
    { name: "Light Pink", value: "#FCE4EC" },
    { name: "Light Yellow", value: "#FFFDE7" },
    { name: "Light Orange", value: "#FFF3E0" },
    { name: "Light Purple", value: "#F3E5F5" },
    { name: "Light Red", value: "#FFEBEE" },
    { name: "Light Cyan", value: "#E0F2F1" }
  ];

  const nudge = (axis, direction) => {
    const item = placed.find(i => i.id === selectedId);
    if (!item) return;
    
    const delta = 0.2 * direction;
    const newPosition = [...item.position];
    if (axis === 'x') newPosition[0] += delta;
    if (axis === 'z') newPosition[2] += delta;
    
    updateSelected({ position: newPosition });
  };

  const rotate = (direction) => {
    const item = placed.find(i => i.id === selectedId);
    if (!item) return;
    
    const delta = (Math.PI / 8) * direction;
    const newRotation = [...item.rotation];
    newRotation[1] += delta;
    
    updateSelected({ rotation: newRotation });
  };

  const scale = (direction) => {
    const item = placed.find(i => i.id === selectedId);
    if (!item) return;
    
    const factor = direction > 0 ? 1.1 : 0.9;
    const newScale = item.scale.map(s => s * factor);
    
    updateSelected({ scale: newScale });
  };

  const selectedItem = placed.find(i => i.id === selectedId);

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <div style={{ width: 280, padding: 16, background: "#f6f6f6", overflowY: "auto" }}>
        <h2>3D Floor Plan Editor</h2>
        
        <div style={{ marginBottom: 20 }}>
          <h3>Floor Plan</h3>
          <div style={{ marginBottom: 12 }}>
            <input
              type="file"
              accept=".jpg,.jpeg,.dxf"
              onChange={handleFloorUpload}
              style={{ marginBottom: 8, width: "100%" }}
              disabled={isLoadingFloor}
            />
            {isLoadingFloor && (
              <div style={{ color: "#007bff", fontSize: 12 }}>
                <p>Processing floor plan...</p>
                <p style={{ fontSize: 10, color: "#666" }}>
                  Large files may take longer to process
                </p>
              </div>
            )}
            {uploadedFloor && (
              <div style={{ fontSize: 12, color: "#28a745", marginBottom: 8 }}>
                ✓ Loaded: {uploadedFloor}
              </div>
            )}
            <button 
              onClick={resetToDefaultFloor}
              style={{ 
                padding: "4px 8px", 
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Reset to Default
            </button>
          </div>
          
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3>Furniture Library</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button 
              onClick={() => setPlacingType("chair")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "chair" ? "#28a745" : "#6c757d",
                color: "white",
                border: placingType === "chair" ? "2px solid #20c997" : "2px solid transparent",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: placingType === "chair" ? "bold" : "normal"
              }}
            >
              {placingType === "chair" ? "✓ " : ""}Place Chair
            </button>
            <button 
              onClick={() => setPlacingType("table")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "table" ? "#28a745" : "#6c757d",
                color: "white",
                border: placingType === "table" ? "2px solid #20c997" : "2px solid transparent",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: placingType === "table" ? "bold" : "normal"
              }}
            >
              {placingType === "table" ? "✓ " : ""}Place Table
            </button>
            <button 
              onClick={() => setPlacingType("sofa")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "sofa" ? "#28a745" : "#6c757d",
                color: "white",
                border: placingType === "sofa" ? "2px solid #20c997" : "2px solid transparent",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: placingType === "sofa" ? "bold" : "normal"
              }}
            >
              {placingType === "sofa" ? "✓ " : ""}Place Sofa
            </button>
          </div>
          <small style={{ color: "#666" }}>
            {placingType ? `Click on the floor to place a ${placingType} (one-time placement)` : "Select a furniture type above first"}
          </small>
          {placingType && (
            <div style={{ 
              marginTop: 8, 
              padding: 8, 
              backgroundColor: placingType === "chair" ? "#e3f2fd" : placingType === "table" ? "#f3e5f5" : "#e8f5e8", 
              borderRadius: 4,
              fontSize: 12,
              fontWeight: "bold",
              border: "2px solid #28a745",
              animation: "pulse 1s infinite"
            }}>
              🎯 Currently placing: {placingType.toUpperCase()}
            </div>
          )}
        </div>

        <hr />

        <div style={{ marginBottom: 20 }}>
          <h3>Selected Item</h3>
          {selectedItem ? (
            <div>
              <p><strong>Type:</strong> {selectedItem.type}</p>
              <p><strong>ID:</strong> {selectedItem.id}</p>
              <p><strong>Position:</strong> [{selectedItem.position.map(p => p.toFixed(2)).join(", ")}]</p>
              <p><strong>Rotation:</strong> [{selectedItem.rotation.map(r => (r * 180 / Math.PI).toFixed(1)).join(", ")}°]</p>
              <p><strong>Scale:</strong> [{selectedItem.scale.map(s => s.toFixed(2)).join(", ")}]</p>
            </div>
          ) : (
            <p style={{ color: "#666" }}>No item selected</p>
          )}
        </div>

        {selectedItem && (
          <div style={{ marginBottom: 20 }}>
            <h4>Edit Selected Item</h4>
            
            <div style={{ marginBottom: 12 }}>
              <h5>Furniture Color</h5>
              
              {/* Furniture Color Palette */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 8, maxHeight: "100px", overflowY: "auto" }}>
                {predefinedColors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => changeColor(color.value)}
                    style={{
                      padding: "4px 6px",
                      backgroundColor: color.value,
                      color: color.value === "#FFFFFF" || color.value === "#F5F5F5" || color.value === "#FAFAFA" ? "#000" : "#fff",
                      border: selectedItem.color === parseInt(color.value.replace('#', '0x')) ? "2px solid #28a745" : "1px solid #ccc",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 8,
                      fontWeight: selectedItem.color === parseInt(color.value.replace('#', '0x')) ? "bold" : "normal",
                      textAlign: "left"
                    }}
                    title={color.name}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
              
              {/* Custom Color Picker for Furniture */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 9, fontWeight: "bold", marginBottom: 2, display: "block" }}>
                  Custom:
                </label>
                <input
                  type="color"
                  value={`#${selectedItem.color.toString(16).padStart(6, '0')}`}
                  onChange={(e) => changeColor(e.target.value)}
                  style={{ width: "100%", height: 25, cursor: "pointer" }}
                />
              </div>
              
              {/* Current Furniture Color Display */}
              <div style={{ 
                padding: 6, 
                backgroundColor: `#${selectedItem.color.toString(16).padStart(6, '0')}`, 
                borderRadius: 3,
                textAlign: "center",
                color: selectedItem.color > 0x888888 ? "#000" : "#fff",
                fontSize: 9,
                fontWeight: "bold"
              }}>
                #{selectedItem.color.toString(16).padStart(6, '0').toUpperCase()}
              </div>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <h5>Position</h5>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <button onClick={() => nudge('x', 1)}>Nudge +X</button>
                <button onClick={() => nudge('x', -1)}>Nudge -X</button>
                <button onClick={() => nudge('z', 1)}>Nudge +Z</button>
                <button onClick={() => nudge('z', -1)}>Nudge -Z</button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h5>Rotation</h5>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => rotate(-1)}>Rotate -</button>
                <button onClick={() => rotate(1)}>Rotate +</button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h5>Scale</h5>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => scale(-1)}>Scale -</button>
                <button onClick={() => scale(1)}>Scale +</button>
              </div>
            </div>

            <button 
              onClick={deleteSelected}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                width: "100%"
              }}
            >
              Delete Selected
            </button>
          </div>
        )}

        <hr />

        <div style={{ marginBottom: 20 }}>
          <h3>Wall Color</h3>
          
          {/* Current color display */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                backgroundColor: wallColor,
                border: "2px solid #333",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
              onClick={() => setShowWallColorPicker(!showWallColorPicker)}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>Current Wall Color</div>
              <div style={{ fontSize: 12, color: "#666" }}>{wallColor}</div>
            </div>
          </div>
          
          {/* Predefined colors */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Quick Colors:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {wallColors.map((color) => (
                <div
                  key={color.value}
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: color.value,
                    border: wallColor === color.value ? "3px solid #007bff" : "2px solid #ccc",
                    borderRadius: 4,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                  }}
                  onClick={() => setWallColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
          {/* Force Wall Mode Toggle */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setForceWallMode(!forceWallMode)}
              style={{
                padding: "6px 12px",
                backgroundColor: forceWallMode ? "#dc3545" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              {forceWallMode ? "Disable Force Wall Mode" : "Force All as Walls"}
            </button>
            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
              {forceWallMode ? "All meshes treated as walls" : "Auto-detect floor/wall"}
            </div>
          </div>
          
          {/* Custom color picker */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setShowWallColorPicker(!showWallColorPicker)}
              style={{
                padding: "6px 12px",
                backgroundColor: showWallColorPicker ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              {showWallColorPicker ? "Hide Custom Picker" : "Custom Color"}
            </button>
          </div>
          
          {showWallColorPicker && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Custom Color:</div>
              <input
                type="color"
                value={wallColor}
                onChange={(e) => setWallColor(e.target.value)}
                style={{ 
                  width: "100%", 
                  height: 40, 
                  border: "2px solid #ccc", 
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              />
            </div>
          )}
        </div>

        <div>
          <h3>Layout</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button 
              onClick={saveLayout}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Save Layout
            </button>
            <button 
              onClick={loadLayout}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Load Layout
            </button>
            <button 
              onClick={clearLayout}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: "#ffc107",
                color: "black",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Clear Layout
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Items: {placed.length}
          </p>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <Canvas 
          camera={{ position: [0, 6, 10], fov: 50 }} 
          shadows
          gl={{ 
            antialias: true,
            shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
            outputEncoding: THREE.sRGBEncoding,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0
          }}
        >
          {/* Hemisphere light for natural sky/ground lighting */}
          <hemisphereLight 
            skyColor={0x87CEEB} 
            groundColor={0x8B4513} 
            intensity={0.6} 
          />
          
          {/* Main directional light with shadows */}
          <directionalLight 
            position={[10, 15, 8]} 
            intensity={1.2} 
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-camera-far={50}
            shadow-camera-left={-25}
            shadow-camera-right={25}
            shadow-camera-top={25}
            shadow-camera-bottom={-25}
            shadow-bias={-0.0001}
          />
          
          {/* Fill light for better illumination */}
          <directionalLight position={[-8, 10, 5]} intensity={0.4} />
          
          {/* Low ambient light for overall brightness */}
          <ambientLight intensity={0.3} />
          
          <OrbitControls />
          
          {/* Dynamic Floor GLB */}
          <FloorGLB key={`floor-${wallColor}-${forceWallMode}`} url={floorUrl} wallColor={wallColor} forceWallMode={forceWallMode} />

          {/* Invisible click plane for placement */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              addFurnitureAt(e.point);
            }}
          >
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial visible={false} />
          </mesh>

          {/* Placed furniture items */}
          {placed.map((item) => (
            <Furniture
              key={item.id}
              id={item.id}
              url={`/models/${item.type}.glb`}
              position={item.position}
              rotation={item.rotation}
              scale={item.scale}
              color={item.color}
              onSelect={(id) => setSelectedId(id)}
              isSelected={item.id === selectedId}
            />
          ))}
        </Canvas>
      </div>
    </div>
  );
}
