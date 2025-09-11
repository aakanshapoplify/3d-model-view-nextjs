from typing import List, Tuple, Literal, Optional
from pydantic import BaseModel

Vec2 = Tuple[float, float]

class Point(BaseModel):
    x: float
    y: float

class Wall(BaseModel):
    start: Vec2
    end: Vec2
    thickness: float = 0.15
    height: float = 3.0

class Opening(BaseModel):
    type: Literal["door", "window"]
    wall_index: int
    offset: float
    width: float
    height: float
    sill: float = 0.0

class Door(BaseModel):
    position: Vec2
    width: float
    height: float
    thickness: float = 0.05
    swing_direction: str = "inward"

class Window(BaseModel):
    position: Vec2
    width: float
    height: float
    thickness: float = 0.1
    sill_height: float = 0.9

class Room(BaseModel):
    name: Optional[str] = None
    polygon: List[Vec2]
    elevation: float = 0.0

class Scene(BaseModel):
    units: Literal["meters"] = "meters"
    floorHeight: float = 3.0
    wallThickness: float = 0.15
    walls: List[Wall] = []
    doors: List[Door] = []
    windows: List[Window] = []
    rooms: List[Room] = []
    openings: List[Opening] = []
    materials: dict = {"wall": "paint-white", "floor": "oak-01"}
