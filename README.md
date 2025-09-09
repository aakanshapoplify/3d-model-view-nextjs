# 2D → 3D Floorplan Converter (MVP)

## Prereqs
- Python 3.10+
- Node 18+

## Start backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

## Start frontend
cd ../frontend
npm install
npm run dev
# open http://localhost:5173

## Test conversion (no UI)
cd ../backend
curl -X POST "http://localhost:8080/convert/svg-to-glb" \
  -F "file=@tests/sample_plan.svg" -o out.glb

## Extending to DXF / Raster (next steps)
DXF: add ezdxf to requirements; implement dxf_parser.py reading LINE/LWPOLYLINE and mapping layers to walls/doors/windows.

Openings: extend schema and add a subtraction pass (boolean cuts) per wall using bounding boxes for door/window volumes (trimesh boolean via blender/openSCAD/igl if needed; for speed, pre-split wall quads instead of booleans).

Rooms: read <polygon> or use Shapely polygonization from wall centerlines.

Materials: assign per-mesh PBR materials; export textures using GLB.

Performance: merge static meshes, use instances for repeated furniture.

## Troubleshooting
SVG scale off? Adjust px_to_m in the upload form based on a known dimension in the plan.

Nothing renders? Open DevTools console, ensure GLB endpoint returns 200 and GLTFLoader loads it.

Jagged/overlapping walls? Snap lines in SVG or add a pre-snap routine (angle snapping to 0/90° for MVP).
