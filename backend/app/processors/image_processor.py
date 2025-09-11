"""
Image processing module for converting JPG images to 3D floor plans
"""

import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple, Optional
from ..geometry.schema import Wall, Scene
import io


def detect_walls_from_image(image_data: bytes, px_to_m: float = 0.01, 
                          wall_thickness: float = 0.15, wall_height: float = 3.0,
                          min_wall_length: float = 0.01) -> Scene:
    """
    Convert JPG image to 3D floor plan by detecting walls and rooms
    
    Args:
        image_data: Raw image bytes
        px_to_m: Pixels to meters conversion factor
        wall_thickness: Thickness of walls in meters
        wall_height: Height of walls in meters
        min_wall_length: Minimum wall length to include
    
    Returns:
        Scene object with detected walls
    """
    
    # Load image from bytes
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Could not decode image")
    
    print(f"Processing image: {image.shape[1]}x{image.shape[0]} pixels")
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply preprocessing to enhance wall detection
    processed_image = preprocess_image(gray)
    
    # Detect walls using multiple methods
    walls = []
    
    # Method 1: Detect external walls (building outline)
    external_walls = detect_external_walls(processed_image, px_to_m, wall_thickness, wall_height, min_wall_length)
    walls.extend(external_walls)
    
    # Method 2: Detect internal walls (room dividers) - only if we have external walls
    if external_walls:
        internal_walls = detect_internal_walls(processed_image, px_to_m, wall_thickness, wall_height, min_wall_length)
        walls.extend(internal_walls)
    
    # Method 3: Detect walls from line detection - only if we don't have enough walls
    if len(walls) < 4:  # Minimum for a basic room
        line_walls = detect_walls_from_lines(processed_image, px_to_m, wall_thickness, wall_height, min_wall_length)
        walls.extend(line_walls)
    
    # Remove duplicate walls
    unique_walls = remove_duplicate_walls(walls)
    
    # Filter walls by length
    filtered_walls = [wall for wall in unique_walls if get_wall_length(wall) >= min_wall_length]
    
    print(f"Created {len(filtered_walls)} walls from image")
    
    # If we don't have enough walls, create a simple rectangular room as fallback
    if len(filtered_walls) < 4:
        print("Not enough walls detected, creating simple rectangular room as fallback")
        filtered_walls = create_simple_room_fallback(px_to_m, wall_thickness, wall_height)
    
    # Calculate wall length statistics
    if filtered_walls:
        lengths = [get_wall_length(wall) for wall in filtered_walls]
        print(f"Wall length stats: min={min(lengths):.3f}m, max={max(lengths):.3f}m, avg={np.mean(lengths):.3f}m")
    
    return Scene(walls=filtered_walls, rooms=[], wallThickness=wall_thickness, floorHeight=wall_height)


def create_simple_room_fallback(px_to_m: float, wall_thickness: float, wall_height: float) -> List[Wall]:
    """Create a simple rectangular room as fallback when image processing fails"""
    
    # Create a simple 10m x 8m room
    room_width = 10.0  # meters
    room_height = 8.0  # meters
    
    walls = [
        # Bottom wall
        Wall(start=(0, 0), end=(room_width, 0), thickness=wall_thickness, height=wall_height),
        # Right wall
        Wall(start=(room_width, 0), end=(room_width, room_height), thickness=wall_thickness, height=wall_height),
        # Top wall
        Wall(start=(room_width, room_height), end=(0, room_height), thickness=wall_thickness, height=wall_height),
        # Left wall
        Wall(start=(0, room_height), end=(0, 0), thickness=wall_thickness, height=wall_height),
    ]
    
    print(f"Created fallback room with {len(walls)} walls")
    return walls


def preprocess_image(gray_image: np.ndarray) -> np.ndarray:
    """Preprocess image to enhance wall detection"""
    
    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray_image, (5, 5), 0)
    
    # Use Otsu's thresholding for better binary conversion
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Invert the image (walls should be white)
    thresh = cv2.bitwise_not(thresh)
    
    # Apply morphological operations to clean up
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    # Remove small noise
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    return thresh


def detect_external_walls(image: np.ndarray, px_to_m: float, wall_thickness: float, 
                         wall_height: float, min_wall_length: float) -> List[Wall]:
    """Detect external walls (building outline)"""
    
    # Find contours
    contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return []
    
    # Filter contours by area (remove very small ones)
    min_area = 1000  # Minimum area in pixels
    valid_contours = [c for c in contours if cv2.contourArea(c) > min_area]
    
    if not valid_contours:
        return []
    
    # Get the largest contour
    largest_contour = max(valid_contours, key=cv2.contourArea)
    
    # Approximate the contour to get cleaner lines
    epsilon = 0.02 * cv2.arcLength(largest_contour, True)
    approx = cv2.approxPolyDP(largest_contour, epsilon, True)
        
        # Convert to walls
    walls = contour_to_walls(approx, px_to_m, wall_thickness, wall_height, min_wall_length)
    
    print(f"Detected {len(walls)} external walls")
    return walls


def detect_internal_walls(image: np.ndarray, px_to_m: float, wall_thickness: float, 
                         wall_height: float, min_wall_length: float) -> List[Wall]:
    """Detect internal walls (room dividers)"""
    
    # Use HoughLinesP to detect straight lines with stricter parameters
    lines = cv2.HoughLinesP(
        image, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=5
    )
    
    walls = []
    
    if lines is not None:
        # Filter lines by length and angle
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # Calculate length
            length = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            
            # Only process lines that are long enough
            if length < 50:  # Minimum 50 pixels
                continue
                
            # Calculate angle
            angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
            angle = abs(angle)
            
            # Only keep lines that are roughly horizontal or vertical
            if not (angle < 15 or angle > 165 or (75 < angle < 105)):
                continue
            
            # Convert to meters
            start = (x1 * px_to_m, y1 * px_to_m)
            end = (x2 * px_to_m, y2 * px_to_m)
            
            # Calculate length in meters
            length_m = length * px_to_m
            
            if length_m >= min_wall_length:
                wall = Wall(
                    start=start,
                    end=end,
                    thickness=wall_thickness,
                    height=wall_height
                )
                walls.append(wall)
    
    print(f"Detected {len(walls)} internal walls from lines")
    return walls


def detect_walls_from_lines(image: np.ndarray, px_to_m: float, wall_thickness: float, 
                           wall_height: float, min_wall_length: float) -> List[Wall]:
    """Detect walls using line detection and morphological operations"""
    
    # Detect lines using Hough transform
    lines = cv2.HoughLines(image, 1, np.pi/180, threshold=50)
    
    walls = []
    
    if lines is not None:
        for line in lines:
            rho, theta = line[0]
            
            # Convert polar coordinates to Cartesian
            a = np.cos(theta)
            b = np.sin(theta)
            x0 = a * rho
            y0 = b * rho
            
            # Calculate line endpoints
            x1 = int(x0 + 1000 * (-b))
            y1 = int(y0 + 1000 * (a))
            x2 = int(x0 - 1000 * (-b))
            y2 = int(y0 - 1000 * (a))
            
            # Convert to meters
            start = (x1 * px_to_m, y1 * px_to_m)
            end = (x2 * px_to_m, y2 * px_to_m)
            
            # Calculate length
            length = np.sqrt((x2 - x1)**2 + (y2 - y1)**2) * px_to_m
            
            if length >= min_wall_length:
                wall = Wall(
                    start=start,
                    end=end,
                    thickness=wall_thickness,
                    height=wall_height
                )
                walls.append(wall)
    
    print(f"Detected {len(walls)} walls from Hough lines")
    return walls


def contour_to_walls(contour: np.ndarray, px_to_m: float, wall_thickness: float, 
                    wall_height: float, min_wall_length: float) -> List[Wall]:
    """Convert contour points to wall segments"""
    
    walls = []
    
    for i in range(len(contour)):
        # Get current and next point
        pt1 = contour[i][0]
        pt2 = contour[(i + 1) % len(contour)][0]
        
        # Convert to meters
        x1, y1 = pt1[0] * px_to_m, pt1[1] * px_to_m
        x2, y2 = pt2[0] * px_to_m, pt2[1] * px_to_m
        
        # Calculate wall length
        length = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        
        # Only include significant walls
        if length >= min_wall_length:
            wall = Wall(
                start=(x1, y1),
                end=(x2, y2),
                thickness=wall_thickness,
                height=wall_height
            )
            walls.append(wall)
    
    return walls


def remove_duplicate_walls(walls: List[Wall]) -> List[Wall]:
    """Remove duplicate walls based on start/end points"""
    
    unique_walls = []
    seen = set()
    
    for wall in walls:
        # Create a normalized key (sorted endpoints)
        key = tuple(sorted([wall.start, wall.end]))
        
        if key not in seen:
            seen.add(key)
            unique_walls.append(wall)
    
    return unique_walls


def get_wall_length(wall: Wall) -> float:
    """Calculate the length of a wall"""
    return np.sqrt(
        (wall.end[0] - wall.start[0])**2 + 
        (wall.end[1] - wall.start[1])**2
    )


def detect_rooms_from_image(image_data: bytes, px_to_m: float = 0.01) -> List[dict]:
    """
    Detect rooms from floor plan image (placeholder for future enhancement)
    
    Args:
        image_data: Raw image bytes
        px_to_m: Pixels to meters conversion factor
    
    Returns:
        List of room dictionaries
    """
    # This is a placeholder for future room detection
    # For now, return empty list
    return []