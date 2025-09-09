
import numpy as np
import trimesh
from typing import List, Tuple
from .schema import Scene, Wall

# Create a rectangular prism for each wall segment and combine them into a scene.
# We build local axis-aligned box then rotate & translate it along segment.

def wall_mesh(w: Wall) -> trimesh.Trimesh:
    start = np.array([w.start[0], 0.0, w.start[1]])
    end   = np.array([w.end[0],   0.0, w.end[1]])
    v = end - start
    length = np.linalg.norm([v[0], v[2]])

    # Skip very short walls
    if length < 0.001:
        return None

    # Create a more detailed wall with proper proportions
    # Box extents: (X=length, Y=height, Z=thickness)
    box = trimesh.creation.box(extents=(length, w.height, w.thickness))

    # Move box so its base sits on ground and its x-axis starts at 0
    box.apply_translation([length/2, w.height/2, 0])

    # Rotate to align with the segment in XZ plane
    angle = -np.arctan2(v[2], v[0])
    R = trimesh.transformations.rotation_matrix(angle, [0,1,0])
    box.apply_transform(R)

    # Translate to start position
    box.apply_translation(start)
    
    # Add visual enhancements
    try:
        # Ensure proper normals
        if hasattr(box, 'fix_normals'):
            box.fix_normals()
        
        # Clean up the mesh
        box.remove_duplicate_faces()
        box.remove_degenerate_faces()
        
        # Add some visual detail - create a slight bevel effect
        if length > 1.0:  # Only for longer walls
            # Create a slightly tapered top edge
            vertices = box.vertices.copy()
            face_centers = box.vertices[box.faces].mean(axis=1)
            top_faces = face_centers[:, 1] > w.height * 0.8
            
            if np.any(top_faces):
                # Slightly reduce the top edge thickness
                top_vertices = vertices[:, 1] > w.height * 0.9
                vertices[top_vertices, 2] *= 0.95  # Slight taper
                box.vertices = vertices
        
    except Exception as e:
        # If enhancement fails, just ensure basic validity
        try:
            box.remove_duplicate_faces()
            box.remove_degenerate_faces()
        except:
            pass
    
    return box

def merge_connected_walls(walls: List[Wall], tolerance: float = 0.01) -> List[Wall]:
    """Improved wall merging - remove duplicates and merge collinear walls"""
    if not walls:
        return walls
    
    print(f"Starting with {len(walls)} walls")
    
    # First pass: remove exact duplicates and very short walls
    unique_walls = []
    seen_segments = set()
    
    for wall in walls:
        # Create a normalized segment key
        start = (round(wall.start[0], 3), round(wall.start[1], 3))
        end = (round(wall.end[0], 3), round(wall.end[1], 3))
        segment = tuple(sorted([start, end]))
        
        # Skip if duplicate or too short
        if segment not in seen_segments:
            length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
            if length >= tolerance:
                seen_segments.add(segment)
                unique_walls.append(wall)
    
    print(f"After removing duplicates: {len(unique_walls)} walls")
    
    # Second pass: merge collinear walls (simplified approach)
    merged_walls = []
    used_indices = set()
    
    for i, wall1 in enumerate(unique_walls):
        if i in used_indices:
            continue
            
        # Find collinear walls that can be merged
        merged_wall = wall1
        merged_count = 0
        
        for j, wall2 in enumerate(unique_walls[i+1:], i+1):
            if j in used_indices:
                continue
                
            # Check if walls are collinear and connected
            if are_walls_mergeable(merged_wall, wall2, tolerance):
                merged_wall = merge_two_walls(merged_wall, wall2)
                used_indices.add(j)
                merged_count += 1
        
        merged_walls.append(merged_wall)
        used_indices.add(i)
        
        if merged_count > 0:
            print(f"Merged {merged_count + 1} walls into one")
    
    print(f"Final merged walls: {len(merged_walls)}")
    return merged_walls

def are_walls_mergeable(wall1: Wall, wall2: Wall, tolerance: float) -> bool:
    """Check if two walls can be merged (collinear and connected)"""
    # Check if walls share an endpoint
    def points_equal(p1, p2, tol=tolerance):
        return abs(p1[0] - p2[0]) < tol and abs(p1[1] - p2[1]) < tol
    
    # Check if walls share an endpoint
    if not (points_equal(wall1.start, wall2.start) or 
            points_equal(wall1.start, wall2.end) or
            points_equal(wall1.end, wall2.start) or
            points_equal(wall1.end, wall2.end)):
        return False
    
    # Check if walls are collinear
    v1 = (wall1.end[0] - wall1.start[0], wall1.end[1] - wall1.start[1])
    v2 = (wall2.end[0] - wall2.start[0], wall2.end[1] - wall2.start[1])
    
    # Normalize vectors
    len1 = (v1[0]**2 + v1[1]**2)**0.5
    len2 = (v2[0]**2 + v2[1]**2)**0.5
    
    if len1 < tolerance or len2 < tolerance:
        return False
    
    v1_norm = (v1[0]/len1, v1[1]/len1)
    v2_norm = (v2[0]/len2, v2[1]/len2)
    
    # Check if vectors are parallel (dot product close to 1 or -1)
    dot_product = abs(v1_norm[0] * v2_norm[0] + v1_norm[1] * v2_norm[1])
    
    # Also check if walls have similar thickness and height
    thickness_similar = abs(wall1.thickness - wall2.thickness) < tolerance
    height_similar = abs(wall1.height - wall2.height) < tolerance
    
    return dot_product > 0.99 and thickness_similar and height_similar

def merge_two_walls(wall1: Wall, wall2: Wall) -> Wall:
    """Merge two collinear walls into one"""
    # Find all four endpoints
    points = [wall1.start, wall1.end, wall2.start, wall2.end]
    
    # Find the two points that are furthest apart
    max_dist = 0
    start_point = points[0]
    end_point = points[1]
    
    for i in range(len(points)):
        for j in range(i+1, len(points)):
            dist = ((points[i][0] - points[j][0])**2 + (points[i][1] - points[j][1])**2)**0.5
            if dist > max_dist:
                max_dist = dist
                start_point = points[i]
                end_point = points[j]
    
    return Wall(
        start=start_point,
        end=end_point,
        thickness=wall1.thickness,
        height=wall1.height
    )

def build_scene_mesh(scene: Scene) -> trimesh.Scene:
    print(f"Building scene with {len(scene.walls)} walls")
    
    # Merge connected walls to reduce geometry
    merged_walls = merge_connected_walls(scene.walls)
    print(f"After merging: {len(merged_walls)} walls")
    
    if not merged_walls:
        print("No walls to process")
        return trimesh.Scene()
    
    meshes: List[trimesh.Trimesh] = []
    valid_meshes = 0
    
    for i, w in enumerate(merged_walls):
        try:
            mesh = wall_mesh(w)
            if mesh is not None and hasattr(mesh, 'vertices') and len(mesh.vertices) > 0:
                meshes.append(mesh)
                valid_meshes += 1
            else:
                print(f"Skipped wall {i} (too short or invalid)")
        except Exception as e:
            print(f"Error creating mesh for wall {i}: {e}")
            # Continue processing other walls instead of failing completely
            continue
    
    print(f"Created {valid_meshes} valid wall meshes")
    
    if not meshes:
        print("No valid meshes created")
        return trimesh.Scene()
    
    # Combine all meshes into a single mesh
    try:
        print("Combining meshes...")
        combined = trimesh.util.concatenate(meshes)
        print(f"Combined mesh has {len(combined.vertices)} vertices and {len(combined.faces)} faces")
        
        # Clean up the mesh
        print("Cleaning up mesh...")
        try:
            combined.remove_duplicate_faces()
        except:
            pass
        try:
            combined.remove_degenerate_faces()
        except:
            pass
        try:
            combined.remove_unreferenced_vertices()
        except:
            pass
        
        # Additional cleanup to ensure single model
        try:
            if hasattr(combined, 'merge_vertices'):
                combined.merge_vertices()
        except:
            pass
        
        # Ensure we have a valid mesh
        if not hasattr(combined, 'vertices') or len(combined.vertices) == 0:
            print("Warning: Combined mesh has no vertices")
            return trimesh.Scene()
        
        print(f"After cleanup: {len(combined.vertices)} vertices and {len(combined.faces)} faces")
        
        # Create a single scene with one geometry
        sc = trimesh.Scene()
        sc.add_geometry(combined, node_name="floorplan_walls")
        
        # Add a realistic floor if we have walls
        if len(combined.vertices) > 0:
            try:
                # Create a more realistic floor
                bounds = combined.bounds
                floor_width = bounds[1][0] - bounds[0][0]
                floor_depth = bounds[1][2] - bounds[0][2]
                
                # Create floor with slight padding
                padding = 2.0  # 2 meters padding around the walls
                floor_width += padding * 2
                floor_depth += padding * 2
                
                # Create a thicker, more realistic floor
                floor_thickness = 0.1  # 10cm floor thickness
                floor = trimesh.creation.box(extents=(floor_width, floor_thickness, floor_depth))
                
                # Position floor below walls
                floor_center_x = (bounds[0][0] + bounds[1][0]) / 2
                floor_center_z = (bounds[0][2] + bounds[1][2]) / 2
                floor.apply_translation([floor_center_x, -floor_thickness/2, floor_center_z])
                
                sc.add_geometry(floor, node_name="floor")
                print(f"Added floor plane: {floor_width:.1f}m x {floor_depth:.1f}m")
            except Exception as e:
                print(f"Could not add floor: {e}")
        
        return sc
        
    except Exception as e:
        print(f"Error combining meshes: {e}")
        import traceback
        traceback.print_exc()
        # Fallback: create individual meshes but still in one scene
        sc = trimesh.Scene()
        for i, mesh in enumerate(meshes):
            sc.add_geometry(mesh, node_name=f"wall_{i}")
        return sc
