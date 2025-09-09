# Backend

## Setup
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt

## Run
uvicorn app.main:app --reload --port 8083

## Test
curl -X POST "http://localhost:8083/convert/svg-to-glb" \
  -F "file=@tests/sample_plan.svg" \
  -F "px_to_m=0.01" -F "wall_thickness=0.15" -F "wall_height=3.0" \
  -o out.glb
