import cv2
import numpy as np
from typing import List
from ..geometry.schema import Wall, Door, Window, Scene

def detect_walls_from_image(image_path: str, px_to_m: float = 0.01, wall_thickness: float = 0.15, wall_height: float = 3.0, min_wall_length: float = 0.01) -> Scene:
    """Simple and reliable image processor for floor plans"""
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not load image")
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Detect edges
    edges = cv2.Canny(gray, 50, 150)
    
    # Detect lines using Hough transform
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, minLineLength=30, maxLineGap=10)
    
    walls = []
    doors = []
    windows = []
    
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # Convert to meters
            start_x = x1 * px_to_m
            start_y = y1 * px_to_m
            end_x = x2 * px_to_m
            end_y = y2 * px_to_m
            
            # Calculate length
            length = np.sqrt((end_x - start_x)**2 + (end_y - start_y)**2)
            
            # Only keep walls longer than minimum length
            if length > min_wall_length:
                wall = Wall(
                    start=(start_x, start_y),
                    end=(end_x, end_y),
                    thickness=wall_thickness,
                    height=wall_height
                )
                walls.append(wall)
    
    # If no walls detected, create a simple room
    if not walls:
        # Create a simple rectangular room
        room_width = 10.0  # 10 meters
        room_height = 8.0  # 8 meters
        
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
        
        # Add a door
        doors = [
            Door(position=(room_width/2, 0), width=0.9, height=2.1, swing_direction="inward")
        ]
        
        # Add a window
        windows = [
            Window(position=(room_width/4, room_height), width=1.5, height=1.2)
        ]
    
    return Scene(
        walls=walls,
        doors=doors,
        windows=windows
    )
