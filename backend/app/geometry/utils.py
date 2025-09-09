import math
from typing import Tuple

Vec2 = Tuple[float, float]

def length(a: Vec2, b: Vec2) -> float:
    return math.hypot(b[0]-a[0], b[1]-a[1])
