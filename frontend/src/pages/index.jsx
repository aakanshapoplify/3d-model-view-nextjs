import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function FloorGLB({ url, wallColor }) {
  const { scene } = useGLTF(url);
  
  // Clone the scene to modify wall materials
  const clonedScene = scene.clone();
  clonedScene.traverse((child) => {
    if (child.isMesh && child.name.toLowerCase().includes('wall')) {
      child.material = child.material.clone();
      child.material.color.setHex(wallColor);
    }
  });
  
  return <primitive object={clonedScene} />;
}

function Furniture({ id, url, position, rotation, scale, color, onSelect, isSelected }) {
  const { scene } = useGLTF(url);
  
  // Clone the scene to modify materials
  const clonedScene = scene.clone();
  clonedScene.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
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

export default function FloorEditor() {
  const [placed, setPlaced] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [placingType, setPlacingType] = useState(null); // No default selection
  const [floorUrl, setFloorUrl] = useState("/floor.glb");
  const [isLoadingFloor, setIsLoadingFloor] = useState(false);
  const [uploadedFloor, setUploadedFloor] = useState(null);
  const [wallColor, setWallColor] = useState(0xFFFFFF); // Default white walls

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
      alert("Please select a furniture type first (Chair, Table, or Sofa)");
      return;
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
    alert("Layout saved to localStorage");
  };

  const loadLayout = () => {
    const data = localStorage.getItem("layout");
    if (data) {
      try {
        setPlaced(JSON.parse(data));
        alert("Layout loaded from localStorage");
      } catch (e) {
        alert("Failed to load layout");
      }
    } else {
      alert("No saved layout found");
    }
  };

  const clearLayout = () => {
    setPlaced([]);
    setSelectedId(null);
    localStorage.removeItem("layout");
    alert("Layout cleared");
  };

  const handleFloorUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoadingFloor(true);
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
        alert('Unsupported file type. Please upload JPG or DXF files.');
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
      
      alert(`Floor plan "${file.name}" loaded successfully!`);
    } catch (error) {
      console.error('Error uploading floor:', error);
      alert('Failed to process floor plan. Please try again.');
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
    { name: "Brown", value: "#8B4513" },
    { name: "Black", value: "#000000" },
    { name: "White", value: "#FFFFFF" },
    { name: "Red", value: "#FF0000" },
    { name: "Blue", value: "#0000FF" },
    { name: "Green", value: "#008000" },
    { name: "Yellow", value: "#FFFF00" },
    { name: "Gray", value: "#808080" }
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
              <p style={{ color: "#007bff", fontSize: 12 }}>Processing floor plan...</p>
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
          
          <div style={{ marginBottom: 12 }}>
            <h4>Wall Color</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
              {predefinedColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setWallColor(parseInt(color.value.replace('#', '0x')))}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: color.value,
                    color: color.value === "#FFFFFF" ? "#000" : "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 10
                  }}
                >
                  {color.name}
                </button>
              ))}
            </div>
            <input
              type="color"
              value={`#${wallColor.toString(16).padStart(6, '0')}`}
              onChange={(e) => setWallColor(parseInt(e.target.value.replace('#', '0x')))}
              style={{ width: "100%", height: 30 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3>Furniture Library</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button 
              onClick={() => setPlacingType("chair")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "chair" ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Place Chair
            </button>
            <button 
              onClick={() => setPlacingType("table")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "table" ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Place Table
            </button>
            <button 
              onClick={() => setPlacingType("sofa")}
              style={{ 
                padding: "8px 16px", 
                backgroundColor: placingType === "sofa" ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Place Sofa
            </button>
          </div>
          <small style={{ color: "#666" }}>
            Click on the floor to place the selected item
          </small>
          <div style={{ 
            marginTop: 8, 
            padding: 8, 
            backgroundColor: placingType === "chair" ? "#e3f2fd" : placingType === "table" ? "#f3e5f5" : "#e8f5e8", 
            borderRadius: 4,
            fontSize: 12,
            fontWeight: "bold"
          }}>
            Currently placing: {placingType.toUpperCase()}
          </div>
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
              <h5>Color</h5>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                {predefinedColors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => changeColor(color.value)}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: color.value,
                      color: color.value === "#FFFFFF" ? "#000" : "#fff",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 10
                    }}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={`#${selectedItem.color.toString(16).padStart(6, '0')}`}
                onChange={(e) => changeColor(e.target.value)}
                style={{ width: "100%", height: 30 }}
              />
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
        <Canvas camera={{ position: [0, 6, 10], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <OrbitControls />
          
          {/* Dynamic Floor GLB */}
          <FloorGLB url={floorUrl} wallColor={wallColor} />

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
