"""
Foodshare - Machine Learning Microservice
Exposes REST endpoints for:
1. Multi-factor Intelligent Food Matching & Recommendation
2. Image Integrity & Duplicate Detection
"""

import os
import base64
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from matcher import rank_listings, calculate_match
from integrity import verify_image

app = FastAPI(
    title="Foodshare - ML Matching & Integrity Microservice",
    version="1.0.0",
    description="Python microservice powering intelligent matching and image integrity verification."
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatchRequest(BaseModel):
    recipient: Dict[str, Any]
    listings: List[Dict[str, Any]]
    limit: Optional[int] = 20

class SingleMatchRequest(BaseModel):
    recipient: Dict[str, Any]
    listing: Dict[str, Any]

class ImageVerifyPayload(BaseModel):
    imageBase64: Optional[str] = None
    existingHashes: Optional[List[Dict[str, Any]]] = None

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Foodshare ML Service",
        "version": "1.0.0"
    }

@app.post("/api/ml/match")
def match_listings(payload: MatchRequest):
    """
    Ranks listings by distance, urgency, suitability, reliability, and storage compatibility.
    """
    try:
        ranked = rank_listings(payload.recipient, payload.listings, limit=payload.limit or 20)
        return {
            "success": True,
            "totalRanked": len(ranked),
            "recommendations": ranked
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matching calculation failed: {str(e)}")

@app.post("/api/ml/single-match")
def single_match(payload: SingleMatchRequest):
    """
    Calculates detailed score and breakdown for a single listing against a recipient.
    """
    try:
        match_result = calculate_match(payload.recipient, payload.listing)
        return {
            "success": True,
            "result": match_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Single match failed: {str(e)}")

@app.post("/api/ml/verify-image-upload")
async def verify_image_upload(
    file: UploadFile = File(...),
    existingHashesJson: Optional[str] = Form(None)
):
    """
    Verifies an uploaded image file for quality, sharpness, blur, and duplicate perceptual hashes.
    """
    try:
        contents = await file.read()
        import json
        existing_hashes = []
        if existingHashesJson:
            try:
                existing_hashes = json.loads(existingHashesJson)
            except Exception:
                existing_hashes = []

        result = verify_image(contents, existing_hashes=existing_hashes)
        return {
            "success": True,
            "integrity": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image verification error: {str(e)}")

@app.post("/api/ml/verify-image-json")
def verify_image_json(payload: ImageVerifyPayload):
    """
    Verifies base64 encoded image string for quality, blur, and duplicate hashes.
    """
    if not payload.imageBase64:
        raise HTTPException(status_code=400, detail="Missing imageBase64 data.")

    try:
        # Strip data URL header if present (data:image/jpeg;base64,...)
        b64_data = payload.imageBase64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        image_bytes = base64.b64decode(b64_data)
        result = verify_image(image_bytes, existing_hashes=payload.existingHashes or [])
        return {
            "success": True,
            "integrity": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image decoding/verification error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5001))
    print(f"Starting Foodshare ML service on port {port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

