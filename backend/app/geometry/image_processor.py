"""
Image processing module for converting JPG images to 3D floor plans
"""

import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple, Optional
from .schema import Wall, Scene
import io


def detect_walls_from_image(image_data: bytes, px_to_m: float = 0.01, 
                          wall_thickness: float = 0.15, wall_height: float = 3.0,
                          min_wall_length: float = 0.01) -> Scene:
    """
    Convert JPG image to 3D floor plan by detecting walls
    
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
    
    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Edge detection using Canny
    edges = cv2.Canny(blurred, 50, 150)
    
    # Morphological operations to clean up edges
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"Found {len(contours)} contours")
    
    walls: List[Wall] = []
    
    for contour in contours:
        # Approximate contour to polygon
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Convert to walls
        contour_walls = contour_to_walls(approx, px_to_m, wall_thickness, wall_height, min_wall_length)
        walls.extend(contour_walls)
    
    # Remove duplicate walls
    unique_walls = remove_duplicate_walls(walls)
    
    print(f"Created {len(unique_walls)} unique walls from image")
    
    return Scene(walls=unique_walls, rooms=[], wallThickness=wall_thickness, floorHeight=wall_height)


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


def remove_duplicate_walls(walls: List[Wall], tolerance: float = 0.01) -> List[Wall]:
    """Remove duplicate walls based on endpoint similarity"""
    
    unique_walls = []
    seen_walls = set()
    
    for wall in walls:
        # Create normalized wall key (sorted endpoints)
        start = (round(wall.start[0], 3), round(wall.start[1], 3))
        end = (round(wall.end[0], 3), round(wall.end[1], 3))
        wall_key = tuple(sorted([start, end]))
        
        if wall_key not in seen_walls:
            seen_walls.add(wall_key)
            unique_walls.append(wall)
    
    return unique_walls


def detect_rooms_from_image(image_data: bytes, px_to_m: float = 0.01) -> List[Tuple]:
    """
    Detect room boundaries from image (simplified version)
    This is a placeholder for more advanced room detection
    """
    
    # For now, return empty list
    # In a full implementation, you would:
    # 1. Detect closed contours
    # 2. Filter by size and shape
    # 3. Convert to room polygons
    
    return []


def preprocess_image_for_wall_detection(image: np.ndarray) -> np.ndarray:
    """
    Preprocess image to improve wall detection
    """
    
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Apply histogram equalization to improve contrast
    equalized = cv2.equalizeHist(gray)
    
    # Apply bilateral filter to reduce noise while preserving edges
    filtered = cv2.bilateralFilter(equalized, 9, 75, 75)
    
    return filtered


def detect_architectural_elements(image: np.ndarray) -> dict:
    """
    Detect various architectural elements in the image
    """
    
    # This is a placeholder for more advanced detection
    # In a full implementation, you would detect:
    # - Doors
    # - Windows
    # - Stairs
    # - Furniture
    
    return {
        'doors': [],
        'windows': [],
        'stairs': [],
        'furniture': []
    }
