from typing import List, Tuple, Literal, Optional
from pydantic import BaseModel

Vec2 = Tuple[float, float]

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

class Room(BaseModel):
    name: Optional[str] = None
    polygon: List[Vec2]
    elevation: float = 0.0

class Scene(BaseModel):
    units: Literal["meters"] = "meters"
    floorHeight: float = 3.0
    wallThickness: float = 0.15
    walls: List[Wall] = []
    rooms: List[Room] = []
    openings: List[Opening] = []
    materials: dict = {"wall": "paint-white", "floor": "oak-01"}
