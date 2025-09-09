from lxml import etree
from typing import List, Tuple
from ..geometry.schema import Scene, Wall, Room

Vec2 = Tuple[float, float]

# Basic SVG parser: reads <line> and <polyline> for walls.
# Assumptions:
# - Coordinates are in the same unit system; we scale by px_to_m if needed.
# - You can extend this with layer/class mapping (e.g., class="wall").

def parse_svg(svg_bytes: bytes, px_to_m: float = 0.01, wall_thickness: float = 0.15, wall_height: float = 3.0) -> Scene:
    try:
        root = etree.fromstring(svg_bytes)
    except Exception as e:
        print(f"Failed to parse SVG: {e}")
        raise ValueError(f"Invalid SVG file: {e}")
    
    # Handle different namespace scenarios
    ns = root.nsmap.get(None, "http://www.w3.org/2000/svg")
    print(f"SVG namespace: {ns}")

    def to_m(x: str) -> float:
        try:
            # Clean up the coordinate string
            x_clean = x.strip()
            # Remove any non-numeric characters except decimal point and minus
            import re
            x_clean = re.sub(r'[^\d\.\-]', '', x_clean)
            if not x_clean:
                return 0.0
            return float(x_clean) * px_to_m
        except (ValueError, TypeError):
            print(f"Warning: Could not parse coordinate '{x}', using 0")
            return 0.0

    def normalize_coordinate(coord: float, precision: int = 3) -> float:
        """Round coordinates to reduce floating point precision issues"""
        return round(coord, precision)

    def is_significant_wall(start: tuple, end: tuple, min_length: float = 0.01) -> bool:
        """Check if wall is significant enough to include"""
        length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
        # Also filter out extremely large walls (likely parsing errors)
        max_length = 1000.0  # 1000 meters max wall length
        return min_length <= length <= max_length

    def add_wall_if_unique(start: tuple, end: tuple) -> bool:
        """Add wall only if it's not a duplicate"""
        # Create normalized wall key (sorted endpoints)
        wall_key = tuple(sorted([start, end]))
        if wall_key not in seen_walls:
            seen_walls.add(wall_key)
            if is_significant_wall(start, end):
                walls.append(Wall(start=start, end=end, thickness=wall_thickness, height=wall_height))
                return True
        return False

    walls: List[Wall] = []
    seen_walls = set()  # Track processed walls to avoid duplicates

    # 1) <line> elements
    line_elements = root.findall(f".//{{{ns}}}line")
    print(f"Found {len(line_elements)} line elements")
    for el in line_elements:
        x1 = normalize_coordinate(to_m(el.get("x1", "0")))
        y1 = normalize_coordinate(to_m(el.get("y1", "0")))
        x2 = normalize_coordinate(to_m(el.get("x2", "0")))
        y2 = normalize_coordinate(to_m(el.get("y2", "0")))
        
        add_wall_if_unique((x1, y1), (x2, y2))

    # 2) <polyline> elements (break into segments)
    polyline_elements = root.findall(f".//{{{ns}}}polyline")
    print(f"Found {len(polyline_elements)} polyline elements")
    for el in polyline_elements:
        pts_attr = el.get("points", "").strip()
        if not pts_attr:
            continue
        
        pts = []
        for pair in pts_attr.split():
            if "," in pair:
                x,y = pair.split(",")
            else:
                # Some SVGs separate by spaces
                xy = pair.split()
                if len(xy) != 2:
                    continue
                x,y = xy
            pts.append((normalize_coordinate(to_m(x)), normalize_coordinate(to_m(y))))
        
        # Remove duplicate consecutive points
        cleaned_pts = [pts[0]]
        for pt in pts[1:]:
            if pt != cleaned_pts[-1]:
                cleaned_pts.append(pt)
        
        print(f"Polyline with {len(cleaned_pts)} points (cleaned from {len(pts)})")
        for i in range(len(cleaned_pts)-1):
            a, b = cleaned_pts[i], cleaned_pts[i+1]
            add_wall_if_unique(a, b)

    # 3) <path> elements with line commands (improved)
    path_elements = root.findall(f".//{{{ns}}}path")
    print(f"Found {len(path_elements)} path elements")
    for el in path_elements:
        d_attr = el.get("d", "").strip()
        if d_attr:
            # Debug: show first 100 chars of path data
            debug_path = d_attr[:100] + "..." if len(d_attr) > 100 else d_attr
            print(f"Processing path: {debug_path}")
            try:
                # Enhanced path parsing for M, L, H, V commands
                # Clean up malformed commands first
                d_attr_clean = d_attr.replace(',', ' ').replace('-', ' -')
                # Fix malformed commands more aggressively
                import re
                # Fix patterns like "123.45H678.90" -> "123.45 H 678.90"
                d_attr_clean = re.sub(r'(\d+\.?\d*)([HV])(\d+\.?\d*)', r'\1 \2 \3', d_attr_clean)
                # Fix patterns like "123.45C678.90" -> "123.45 C 678.90"
                d_attr_clean = re.sub(r'(\d+\.?\d*)([CLM])(\d+\.?\d*)', r'\1 \2 \3', d_attr_clean)
                # Fix patterns like "123.45V678.90Z" -> "123.45 V 678.90 Z"
                d_attr_clean = re.sub(r'(\d+\.?\d*)([V])(\d+\.?\d*)([Z])', r'\1 \2 \3 \4', d_attr_clean)
                commands = d_attr_clean.split()
                if len(commands) >= 4:  # At least M x y L x y
                    i = 0
                    current_x, current_y = 0.0, 0.0
                    
                    while i < len(commands):
                        cmd = commands[i].upper()
                        
                        if cmd == 'M' and i + 2 < len(commands):
                            # Move to absolute position
                            current_x = normalize_coordinate(to_m(commands[i+1]))
                            current_y = normalize_coordinate(to_m(commands[i+2]))
                            i += 3
                            
                        elif cmd == 'L' and i + 2 < len(commands):
                            # Line to absolute position
                            try:
                                end_x = normalize_coordinate(to_m(commands[i+1]))
                                end_y = normalize_coordinate(to_m(commands[i+2]))
                                add_wall_if_unique((current_x, current_y), (end_x, end_y))
                                current_x, current_y = end_x, end_y
                                i += 3
                            except (ValueError, IndexError):
                                # Skip malformed L command
                                i += 1
                            
                        elif cmd == 'H' and i + 1 < len(commands):
                            # Horizontal line
                            try:
                                end_x = normalize_coordinate(to_m(commands[i+1]))
                                add_wall_if_unique((current_x, current_y), (end_x, current_y))
                                current_x = end_x
                                i += 2
                            except (ValueError, IndexError):
                                # Skip malformed H command
                                i += 1
                            
                        elif cmd == 'V' and i + 1 < len(commands):
                            # Vertical line
                            try:
                                end_y = normalize_coordinate(to_m(commands[i+1]))
                                add_wall_if_unique((current_x, current_y), (current_x, end_y))
                                current_y = end_y
                                i += 2
                            except (ValueError, IndexError):
                                # Skip malformed V command
                                i += 1
                            
                        elif cmd == 'Z':
                            # Close path - line back to start
                            i += 1
                            
                        elif cmd in ['C', 'S', 'Q', 'T', 'A']:
                            # Skip complex curves for now, just advance
                            # These are cubic/quadratic curves and arcs
                            i += 1
                            # Skip the parameters for these commands
                            if cmd in ['C', 'S']:  # Cubic curves
                                i += 6
                            elif cmd in ['Q', 'T']:  # Quadratic curves
                                i += 4
                            elif cmd == 'A':  # Arcs
                                i += 7
                            
                        else:
                            # Skip unknown commands
                            i += 1
                            
            except (ValueError, IndexError) as e:
                print(f"Warning: Could not parse path '{d_attr}': {e}")

    # 4) <polygon> elements (treat as closed polylines)
    polygon_elements = root.findall(f".//{{{ns}}}polygon")
    print(f"Found {len(polygon_elements)} polygon elements")
    for el in polygon_elements:
        pts_attr = el.get("points", "").strip()
        if not pts_attr:
            continue
        
        pts = []
        for pair in pts_attr.split():
            if "," in pair:
                x,y = pair.split(",")
            else:
                xy = pair.split()
                if len(xy) != 2:
                    continue
                x,y = xy
            pts.append((normalize_coordinate(to_m(x)), normalize_coordinate(to_m(y))))
        
        # Remove duplicate consecutive points
        cleaned_pts = [pts[0]]
        for pt in pts[1:]:
            if pt != cleaned_pts[-1]:
                cleaned_pts.append(pt)
        
        # Close the polygon if not already closed
        if len(cleaned_pts) > 2 and cleaned_pts[0] != cleaned_pts[-1]:
            cleaned_pts.append(cleaned_pts[0])
        
        print(f"Polygon with {len(cleaned_pts)} points")
        for i in range(len(cleaned_pts)-1):
            a, b = cleaned_pts[i], cleaned_pts[i+1]
            add_wall_if_unique(a, b)

    # 5) Extract walls from <rect> elements as fallback
    rect_elements = root.findall(f".//{{{ns}}}rect")
    print(f"Found {len(rect_elements)} rect elements")
    for el in rect_elements:
        try:
            x = normalize_coordinate(to_m(el.get("x", "0")))
            y = normalize_coordinate(to_m(el.get("y", "0")))
            width = normalize_coordinate(to_m(el.get("width", "0")))
            height = normalize_coordinate(to_m(el.get("height", "0")))
            
            if width > 0 and height > 0:
                # Create 4 walls for the rectangle
                corners = [
                    (x, y),
                    (x + width, y),
                    (x + width, y + height),
                    (x, y + height)
                ]
                
                for i in range(4):
                    start = corners[i]
                    end = corners[(i + 1) % 4]
                    add_wall_if_unique(start, end)
        except (ValueError, TypeError) as e:
            print(f"Warning: Could not parse rect: {e}")

    # 6) If we still don't have enough walls, try to extract from all path elements more aggressively
    if len(walls) < 10:  # If we have very few walls, try a different approach
        print("Few walls found, trying aggressive path extraction...")
        for el in path_elements:
            d_attr = el.get("d", "").strip()
            if d_attr:
                # Extract all coordinate pairs from the path
                import re
                # Find all coordinate pairs (x,y) or (x y)
                coords = re.findall(r'(\d+\.?\d*)[,\s]+(\d+\.?\d*)', d_attr)
                if len(coords) >= 2:
                    # Convert to normalized coordinates
                    points = []
                    for x_str, y_str in coords:
                        try:
                            x = normalize_coordinate(to_m(x_str))
                            y = normalize_coordinate(to_m(y_str))
                            points.append((x, y))
                        except:
                            continue
                    
                    # Create walls between consecutive points
                    for i in range(len(points) - 1):
                        add_wall_if_unique(points[i], points[i + 1])
                    
                    print(f"Extracted {len(points)} points from path, created walls")

    # 6) Very naive room detection (optional):
    rooms: List[Room] = []
    # For MVP, leave empty; add polygonization later or read <polygon> as rooms.

    print(f"Total walls created: {len(walls)}")
    return Scene(walls=walls, rooms=rooms, wallThickness=wall_thickness, floorHeight=wall_height)

