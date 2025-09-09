"""
CAD file processing module for converting DXF/DWG files to 3D floor plans
"""

import ezdxf
import io
from typing import List, Tuple, Optional
from ..geometry.schema import Wall, Scene
import numpy as np


def detect_walls_from_cad(cad_data: bytes, px_to_m: float = 0.01, 
                         wall_thickness: float = 0.15, wall_height: float = 3.0,
                         min_wall_length: float = 0.01) -> Scene:
    """
    Convert CAD (DXF) file to 3D floor plan by detecting walls
    
    Args:
        cad_data: Raw CAD file bytes
        px_to_m: Units to meters conversion factor (DXF files have their own units)
        wall_thickness: Thickness of walls in meters
        wall_height: Height of walls in meters
        min_wall_length: Minimum wall length to include
    
    Returns:
        Scene object with detected walls
    """
    
    try:
        # Check if it's a DWG file (binary format)
        if cad_data.startswith(b'AC10') or cad_data.startswith(b'AC10'):
            raise ValueError("DWG files are not supported. Please convert your DWG file to DXF format first. You can do this in AutoCAD or other CAD software by using 'Save As' and selecting DXF format.")
        
        # Load DXF document from bytes
        # Try different encodings and formats
        try:
            doc = ezdxf.read(io.BytesIO(cad_data))
        except Exception as e1:
            try:
                # Try reading as text first
                doc = ezdxf.read(io.StringIO(cad_data.decode('utf-8')))
            except Exception as e2:
                try:
                    # Try with different encoding
                    doc = ezdxf.read(io.StringIO(cad_data.decode('latin-1')))
                except Exception as e3:
                    # Check if it might be a DWG file
                    if b'AC10' in cad_data[:20] or b'AC10' in cad_data[:20]:
                        raise ValueError("This appears to be a DWG file. DWG files are not supported. Please convert your DWG file to DXF format first.")
                    else:
                        raise ValueError(f"Could not read CAD file. Please ensure it's a valid DXF file. Error details: {str(e1)[:200]}")
        
        print(f"Loaded DXF file: {doc.dxfversion}")
        
        # Get model space
        msp = doc.modelspace()
        
        walls: List[Wall] = []
        seen_walls = set()
        
        def add_wall_if_unique(start: tuple, end: tuple) -> bool:
            """Add wall only if it's not a duplicate"""
            # Create normalized wall key (sorted endpoints)
            wall_key = tuple(sorted([start, end]))
            if wall_key not in seen_walls:
                seen_walls.add(wall_key)
                length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
                if length >= min_wall_length:
                    wall = Wall(
                        start=start,
                        end=end,
                        thickness=wall_thickness,
                        height=wall_height
                    )
                    walls.append(wall)
                    return True
            return False
        
        # Process different CAD entities
        print(f"Processing CAD entities...")
        
        # 1. Process LINE entities
        lines = msp.query('LINE')
        line_count = 0
        for line in lines:
            start = (line.dxf.start.x * px_to_m, line.dxf.start.y * px_to_m)
            end = (line.dxf.end.x * px_to_m, line.dxf.end.y * px_to_m)
            if add_wall_if_unique(start, end):
                line_count += 1
        print(f"Processed {line_count} LINE entities")
        
        # 2. Process LWPOLYLINE entities (lightweight polylines)
        lwpolylines = msp.query('LWPOLYLINE')
        lwpoly_count = 0
        for lwpoly in lwpolylines:
            points = list(lwpoly.get_points())
            if len(points) >= 2:
                for i in range(len(points)):
                    start = (points[i][0] * px_to_m, points[i][1] * px_to_m)
                    end = (points[(i + 1) % len(points)][0] * px_to_m, 
                           points[(i + 1) % len(points)][1] * px_to_m)
                    if add_wall_if_unique(start, end):
                        lwpoly_count += 1
        print(f"Processed {lwpoly_count} LWPOLYLINE segments")
        
        # 3. Process POLYLINE entities
        polylines = msp.query('POLYLINE')
        poly_count = 0
        for poly in polylines:
            points = []
            for point in poly.points():
                points.append((point[0] * px_to_m, point[1] * px_to_m))
            
            if len(points) >= 2:
                for i in range(len(points)):
                    start = points[i]
                    end = points[(i + 1) % len(points)]
                    if add_wall_if_unique(start, end):
                        poly_count += 1
        print(f"Processed {poly_count} POLYLINE segments")
        
        # 4. Process ARC entities (convert to line segments)
        arcs = msp.query('ARC')
        arc_count = 0
        for arc in arcs:
            # Convert arc to line segments
            segments = arc_to_line_segments(arc, px_to_m, min_wall_length)
            for start, end in segments:
                if add_wall_if_unique(start, end):
                    arc_count += 1
        print(f"Processed {arc_count} ARC segments")
        
        # 5. Process CIRCLE entities (convert to line segments)
        circles = msp.query('CIRCLE')
        circle_count = 0
        for circle in circles:
            # Convert circle to line segments
            segments = circle_to_line_segments(circle, px_to_m, min_wall_length)
            for start, end in segments:
                if add_wall_if_unique(start, end):
                    circle_count += 1
        print(f"Processed {circle_count} CIRCLE segments")
        
        # 6. Process SPLINE entities (convert to line segments)
        splines = msp.query('SPLINE')
        spline_count = 0
        for spline in splines:
            # Convert spline to line segments
            segments = spline_to_line_segments(spline, px_to_m, min_wall_length)
            for start, end in segments:
                if add_wall_if_unique(start, end):
                    spline_count += 1
        print(f"Processed {spline_count} SPLINE segments")
        
        print(f"Total walls created from CAD: {len(walls)}")
        
        return Scene(walls=walls, rooms=[], wallThickness=wall_thickness, floorHeight=wall_height)
        
    except Exception as e:
        print(f"Error processing CAD file: {e}")
        raise ValueError(f"Failed to process CAD file: {str(e)}")


def arc_to_line_segments(arc, px_to_m: float, min_wall_length: float, segments: int = 8) -> List[Tuple]:
    """Convert ARC entity to line segments"""
    try:
        center = (arc.dxf.center.x * px_to_m, arc.dxf.center.y * px_to_m)
        radius = arc.dxf.radius * px_to_m
        start_angle = np.radians(arc.dxf.start_angle)
        end_angle = np.radians(arc.dxf.end_angle)
        
        # Ensure end_angle > start_angle
        if end_angle <= start_angle:
            end_angle += 2 * np.pi
        
        angle_step = (end_angle - start_angle) / segments
        line_segments = []
        
        for i in range(segments):
            angle1 = start_angle + i * angle_step
            angle2 = start_angle + (i + 1) * angle_step
            
            x1 = center[0] + radius * np.cos(angle1)
            y1 = center[1] + radius * np.sin(angle1)
            x2 = center[0] + radius * np.cos(angle2)
            y2 = center[1] + radius * np.sin(angle2)
            
            start = (x1, y1)
            end = (x2, y2)
            
            # Check if segment is long enough
            length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
            if length >= min_wall_length:
                line_segments.append((start, end))
        
        return line_segments
    except Exception as e:
        print(f"Error converting arc to segments: {e}")
        return []


def circle_to_line_segments(circle, px_to_m: float, min_wall_length: float, segments: int = 16) -> List[Tuple]:
    """Convert CIRCLE entity to line segments"""
    try:
        center = (circle.dxf.center.x * px_to_m, circle.dxf.center.y * px_to_m)
        radius = circle.dxf.radius * px_to_m
        
        angle_step = 2 * np.pi / segments
        line_segments = []
        
        for i in range(segments):
            angle1 = i * angle_step
            angle2 = (i + 1) * angle_step
            
            x1 = center[0] + radius * np.cos(angle1)
            y1 = center[1] + radius * np.sin(angle1)
            x2 = center[0] + radius * np.cos(angle2)
            y2 = center[1] + radius * np.sin(angle2)
            
            start = (x1, y1)
            end = (x2, y2)
            
            # Check if segment is long enough
            length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
            if length >= min_wall_length:
                line_segments.append((start, end))
        
        return line_segments
    except Exception as e:
        print(f"Error converting circle to segments: {e}")
        return []


def spline_to_line_segments(spline, px_to_m: float, min_wall_length: float, segments: int = 20) -> List[Tuple]:
    """Convert SPLINE entity to line segments"""
    try:
        # Get spline points
        points = []
        for point in spline.construction_tool().control_points:
            points.append((point.x * px_to_m, point.y * px_to_m))
        
        if len(points) < 2:
            return []
        
        # Simple linear interpolation between control points
        line_segments = []
        for i in range(len(points) - 1):
            start = points[i]
            end = points[i + 1]
            
            # Check if segment is long enough
            length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
            if length >= min_wall_length:
                line_segments.append((start, end))
        
        return line_segments
    except Exception as e:
        print(f"Error converting spline to segments: {e}")
        return []


def get_cad_info(cad_data: bytes) -> dict:
    """Get information about the CAD file"""
    try:
        # Try different methods to read the DXF file
        try:
            doc = ezdxf.read(io.BytesIO(cad_data))
        except Exception:
            try:
                doc = ezdxf.read(io.StringIO(cad_data.decode('utf-8')))
            except Exception:
                doc = ezdxf.read(io.StringIO(cad_data.decode('latin-1')))
        
        msp = doc.modelspace()
        
        info = {
            'dxf_version': doc.dxfversion,
            'units': doc.header.get('$INSUNITS', 'Unknown'),
            'entities': {
                'lines': len(list(msp.query('LINE'))),
                'lwpolylines': len(list(msp.query('LWPOLYLINE'))),
                'polylines': len(list(msp.query('POLYLINE'))),
                'arcs': len(list(msp.query('ARC'))),
                'circles': len(list(msp.query('CIRCLE'))),
                'splines': len(list(msp.query('SPLINE'))),
            }
        }
        
        return info
    except Exception as e:
        return {'error': str(e)}
