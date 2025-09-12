# 3D Floor Plan Editor - Assets

## Required Files

Place these files in the `public` directory:

### Floor Model
- `floor.glb` - Your converted floor plan 3D model

### Furniture Models
Place these in the `public/models/` directory:
- `chair.glb` - Chair 3D model
- `table.glb` - Table 3D model

## How to Get GLB Files

1. **Convert your floor plan**: Use the backend converter to convert your JPG/DXF floor plan to GLB
2. **Furniture models**: Download free GLB models from:
   - [Sketchfab](https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount&type=models)
   - [Poly Haven](https://polyhaven.com/models)
   - [Free3D](https://free3d.com/)

## File Structure
```
public/
├── floor.glb          ← Your floor plan model
├── models/
│   ├── chair.glb      ← Chair furniture model
│   └── table.glb      ← Table furniture model
└── README.md          ← This file
```

## Usage
1. Place your `floor.glb` in the `public` directory
2. Add furniture GLB files to `public/models/`
3. Start the editor: `npm run dev`
4. Open http://localhost:8083
5. Click "Place Chair" or "Place Table" then click on the floor to place furniture
6. Select items to move, rotate, scale, or delete them
7. Use "Save Layout" to persist your design
