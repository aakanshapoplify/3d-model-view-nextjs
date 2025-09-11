
import numpy as np
import trimesh
from typing import List, Tuple
from .schema import Scene, Wall, Door, Window

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
    
    # Add visual enhancements for better architectural representation
    try:
        # Ensure proper normals
        if hasattr(box, 'fix_normals'):
            box.fix_normals()
        
        # Clean up the mesh
        box.remove_duplicate_faces()
        box.remove_degenerate_faces()
        
        # Add architectural details based on wall characteristics
        if length > 2.0:  # Only for longer walls
            # Create architectural details
            vertices = box.vertices.copy()
            face_centers = box.vertices[box.faces].mean(axis=1)
            
            # Add baseboard detail (slight protrusion at bottom)
            baseboard_faces = face_centers[:, 1] < w.height * 0.1
            if np.any(baseboard_faces):
                # Slightly extend the baseboard
                vertices[vertices[:, 1] < w.height * 0.1, 2] *= 1.1
                box.vertices = vertices
            
            # Add crown molding detail (slight protrusion at top)
            top_faces = face_centers[:, 1] > w.height * 0.9
            if np.any(top_faces):
                # Slightly extend the crown molding
                vertices[vertices[:, 1] > w.height * 0.9, 2] *= 1.05
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
    """Simplified wall merging - remove duplicates only"""
    if not walls:
        return walls
    
    print(f"Starting with {len(walls)} walls")
    
    # Remove exact duplicates and very short walls
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
    print(f"Final merged walls: {len(unique_walls)}")
    return unique_walls

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

def door_mesh(door: Door) -> trimesh.Trimesh:
    """Create a 3D door mesh"""
    # Create door frame
    frame_thickness = 0.1
    frame_width = door.width + 0.2
    frame_height = door.height + 0.2
    
    # Door frame
    frame = trimesh.creation.box(extents=(frame_width, frame_height, frame_thickness))
    frame.apply_translation([0, frame_height/2, 0])
    
    # Door panel
    door_panel = trimesh.creation.box(extents=(door.width, door.height, door.thickness))
    door_panel.apply_translation([0, door.height/2, frame_thickness/2 + door.thickness/2])
    
    # Combine frame and panel
    door_mesh = trimesh.util.concatenate([frame, door_panel])
    
    # Position the door
    door_mesh.apply_translation([door.position[0], 0, door.position[1]])
    
    return door_mesh


def window_mesh(window: Window) -> trimesh.Trimesh:
    """Create a 3D window mesh"""
    # Window frame
    frame_thickness = 0.1
    frame_width = window.width + 0.2
    frame_height = window.height + 0.2
    
    # Window frame
    frame = trimesh.creation.box(extents=(frame_width, frame_height, frame_thickness))
    frame.apply_translation([0, window.sill_height + frame_height/2, 0])
    
    # Window glass (transparent)
    glass = trimesh.creation.box(extents=(window.width, window.height, window.thickness))
    glass.apply_translation([0, window.sill_height + window.height/2, frame_thickness/2 + window.thickness/2])
    
    # Combine frame and glass
    window_mesh = trimesh.util.concatenate([frame, glass])
    
    # Position the window
    window_mesh.apply_translation([window.position[0], 0, window.position[1]])
    
    return window_mesh


def build_scene_mesh(scene: Scene) -> trimesh.Scene:
    print(f"Building scene with {len(scene.walls)} walls, {len(scene.doors)} doors, {len(scene.windows)} windows")
    
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
    
    # Create door meshes
    for i, door in enumerate(scene.doors):
        try:
            mesh = door_mesh(door)
            if mesh is not None and hasattr(mesh, 'vertices') and len(mesh.vertices) > 0:
                meshes.append(mesh)
                valid_meshes += 1
            else:
                print(f"Skipped door {i} (invalid)")
        except Exception as e:
            print(f"Error creating mesh for door {i}: {e}")
            continue
    
    # Create window meshes
    for i, window in enumerate(scene.windows):
        try:
            mesh = window_mesh(window)
            if mesh is not None and hasattr(mesh, 'vertices') and len(mesh.vertices) > 0:
                meshes.append(mesh)
                valid_meshes += 1
            else:
                print(f"Skipped window {i} (invalid)")
        except Exception as e:
            print(f"Error creating mesh for window {i}: {e}")
            continue
    
    print(f"Created {valid_meshes} total valid meshes (walls + doors + windows)")
    
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
        
        # Add a transparent floor if we have walls
        if len(combined.vertices) > 0:
            try:
                # Create a transparent floor
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
                
                # Make the floor transparent
                floor.visual.face_colors = [128, 128, 128, 50]  # Grey with 50/255 transparency
                
                sc.add_geometry(floor, node_name="floor")
                print(f"Added transparent floor plane: {floor_width:.1f}m x {floor_depth:.1f}m")
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
