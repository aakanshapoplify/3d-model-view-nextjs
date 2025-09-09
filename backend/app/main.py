import io
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .geometry.svg_parser import parse_svg
from .geometry.image_processor import detect_walls_from_image
from .geometry.build_mesh import build_scene_mesh

app = FastAPI(title="2D→3D Converter", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8082", "http://127.0.0.1:8082"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/convert/svg-to-glb")
async def convert_svg_to_glb(
    file: UploadFile = File(...),
    px_to_m: float = Form(0.01),
    wall_thickness: float = Form(0.15),
    wall_height: float = Form(3.0),
    merge_walls: bool = Form(True),
    min_wall_length: float = Form(0.01),
):
    if file.content_type not in ("image/svg+xml", "text/xml", "application/xml", "text/plain"):
        return JSONResponse({"error": "Upload an SVG file."}, status_code=400)
    svg_bytes = await file.read()

    try:
        scene = parse_svg(svg_bytes, px_to_m=px_to_m, wall_thickness=wall_thickness, wall_height=wall_height)
        
        # Debug: print scene info
        print(f"Parsed scene with {len(scene.walls)} walls")
        
        if not scene.walls:
            return JSONResponse({"error": "No walls found in SVG. Make sure your SVG contains <line>, <polyline>, or <path> elements."}, status_code=400)
        
        # Print wall statistics
        wall_lengths = [((w.end[0] - w.start[0])**2 + (w.end[1] - w.start[1])**2)**0.5 for w in scene.walls]
        print(f"Wall length stats: min={min(wall_lengths):.3f}m, max={max(wall_lengths):.3f}m, avg={sum(wall_lengths)/len(wall_lengths):.3f}m")
        
        # Filter out very short walls
        if min_wall_length > 0:
            original_count = len(scene.walls)
            scene.walls = [w for w in scene.walls if 
                          ((w.end[0] - w.start[0])**2 + (w.end[1] - w.start[1])**2)**0.5 >= min_wall_length]
            print(f"Filtered walls: {original_count} -> {len(scene.walls)} (min length: {min_wall_length}m)")
        
        if not scene.walls:
            return JSONResponse({"error": f"No walls longer than {min_wall_length}m found in SVG."}, status_code=400)
        
        tm_scene = build_scene_mesh(scene)
        
        # Check if scene has geometry
        if not tm_scene.geometry:
            return JSONResponse({
                "error": "Failed to create 3D geometry from walls. This might be due to:\n" +
                        "1. SVG file contains no valid wall elements\n" +
                        "2. All walls are too short (try reducing min_wall_length)\n" +
                        "3. SVG coordinates are not in expected format\n" +
                        "Please check your SVG file and try adjusting the parameters."
            }, status_code=500)

        buf = io.BytesIO()
        tm_scene.export(buf, file_type='glb')
        
        # Get file size for debugging
        file_size = buf.tell()
        buf.seek(0)
        print(f"Generated GLB file: {file_size} bytes")
        
        headers = {"Content-Disposition": "attachment; filename=scene.glb"}
        return StreamingResponse(buf, media_type="model/gltf-binary", headers=headers)
        
    except Exception as e:
        print(f"Error processing SVG: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": f"Failed to process SVG: {str(e)}"}, status_code=500)


@app.post("/convert/jpg-to-glb")
async def convert_jpg_to_glb(
    file: UploadFile = File(...),
    px_to_m: float = Form(0.01),
    wall_thickness: float = Form(0.15),
    wall_height: float = Form(3.0),
    min_wall_length: float = Form(0.01),
):
    """Convert JPG image to 3D floor plan"""
    
    # Check file type
    if file.content_type not in ("image/jpeg", "image/jpg"):
        return JSONResponse({"error": "Upload a JPG/JPEG file."}, status_code=400)
    
    try:
        # Read image data
        image_data = await file.read()
        
        # Detect walls from image
        scene = detect_walls_from_image(
            image_data, 
            px_to_m=px_to_m, 
            wall_thickness=wall_thickness, 
            wall_height=wall_height,
            min_wall_length=min_wall_length
        )
        
        print(f"Detected {len(scene.walls)} walls from image")
        
        if not scene.walls:
            return JSONResponse({
                "error": "No walls detected in image. Try:\n" +
                        "1. Using a clearer floor plan image\n" +
                        "2. Adjusting the px_to_m parameter\n" +
                        "3. Reducing min_wall_length\n" +
                        "4. Using an image with more defined wall boundaries"
            }, status_code=400)
        
        # Print wall statistics
        wall_lengths = [((w.end[0] - w.start[0])**2 + (w.end[1] - w.start[1])**2)**0.5 for w in scene.walls]
        if wall_lengths:
            print(f"Wall length stats: min={min(wall_lengths):.3f}m, max={max(wall_lengths):.3f}m, avg={sum(wall_lengths)/len(wall_lengths):.3f}m")
        
        # Build 3D mesh
        tm_scene = build_scene_mesh(scene)
        
        if not tm_scene.geometry:
            return JSONResponse({
                "error": "Failed to create 3D geometry from detected walls. This might be due to:\n" +
                        "1. Image quality is too low\n" +
                        "2. Wall detection parameters need adjustment\n" +
                        "3. Image doesn't contain clear architectural elements"
            }, status_code=500)

        # Export to GLB
        buf = io.BytesIO()
        tm_scene.export(buf, file_type='glb')
        
        file_size = buf.tell()
        buf.seek(0)
        print(f"Generated GLB file from JPG: {file_size} bytes")
        
        headers = {"Content-Disposition": "attachment; filename=scene.glb"}
        return StreamingResponse(buf, media_type="model/gltf-binary", headers=headers)
        
    except Exception as e:
        print(f"Error processing JPG: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": f"Failed to process JPG: {str(e)}"}, status_code=500)
