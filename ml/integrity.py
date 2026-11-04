"""
Foodshare - Image Integrity & Quality Verification Engine
Provides perceptual image hashing (dHash, aHash), quality scoring,
blur detection, and duplicate/suspicious image detection.
"""

import io
import base64
import numpy as np
from PIL import Image

def compute_dhash(image: Image.Image, hash_size: int = 8) -> str:
    """
    Computes difference hash (dHash) of an image.
    Robust to resizing, minor color alterations, and recompression.
    """
    # Resize to (hash_size + 1, hash_size) and convert to grayscale
    resized = image.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.float32)
    # Compare adjacent pixels
    difference = pixels[:, 1:] > pixels[:, :-1]
    # Convert binary array to hex string
    binary_str = "".join(["1" if b else "0" for b in difference.flatten()])
    hex_str = f"{int(binary_str, 2):0{hash_size * hash_size // 4}x}"
    return hex_str

def compute_ahash(image: Image.Image, hash_size: int = 8) -> str:
    """
    Computes average hash (aHash) of an image.
    """
    resized = image.convert("L").resize((hash_size, hash_size), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.float32)
    avg = pixels.mean()
    binary_str = "".join(["1" if p > avg else "0" for p in pixels.flatten()])
    hex_str = f"{int(binary_str, 2):0{hash_size * hash_size // 4}x}"
    return hex_str

def hamming_distance(hex1: str, hex2: str) -> int:
    """Calculates bitwise Hamming distance between two hex hashes."""
    try:
        val1 = int(hex1, 16)
        val2 = int(hex2, 16)
        return bin(val1 ^ val2).count("1")
    except Exception:
        return 64

def estimate_sharpness(image: Image.Image) -> float:
    """
    Estimates image sharpness using variance of Laplacian on grayscale numpy array.
    """
    gray = np.array(image.convert("L"), dtype=np.float32)
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    # Discrete Laplacian kernel
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    # Simple valid 2D convolution
    h, w = gray.shape
    lap = (
        gray[1:h-1, 0:w-2] +
        gray[1:h-1, 2:w] +
        gray[0:h-2, 1:w-1] +
        gray[2:h, 1:w-1] -
        4 * gray[1:h-1, 1:w-1]
    )
    return float(np.var(lap))

def verify_image(image_bytes: bytes, existing_hashes: list = None) -> dict:
    """
    Full image integrity analysis:
    - Parses PIL image
    - Computes perceptual hashes (dHash, aHash)
    - Evaluates quality (resolution, brightness, contrast, sharpness)
    - Checks for duplicate / near-identical photos
    """
    if existing_hashes is None:
        existing_hashes = []

    try:
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
    except Exception as e:
        return {
            "verified": False,
            "status": "invalid_format",
            "score": 0.0,
            "dHash": None,
            "aHash": None,
            "flags": ["CORRUPTED_OR_INVALID_IMAGE"],
            "message": f"Could not read image file: {str(e)}"
        }

    flags = []
    reasons = []
    quality_score = 1.0

    # 1. Resolution Check
    if width < 150 or height < 150:
        flags.append("LOW_RESOLUTION")
        reasons.append(f"Image resolution ({width}x{height}) is too small for accurate food verification.")
        quality_score -= 0.35

    # 2. Brightness & Contrast
    np_img = np.array(image.convert("RGB"), dtype=np.float32)
    mean_brightness = float(np.mean(np_img))
    std_contrast = float(np.std(np_img))

    if mean_brightness < 25.0:
        flags.append("EXTREMELY_DARK")
        reasons.append("Image is too dark to clearly inspect food condition.")
        quality_score -= 0.35
    elif mean_brightness > 245.0:
        flags.append("OVEREXPOSED")
        reasons.append("Image is overexposed or blank.")
        quality_score -= 0.35

    if std_contrast < 12.0:
        flags.append("LOW_CONTRAST")
        reasons.append("Image lacks visual detail or contrast.")
        quality_score -= 0.30

    # 3. Sharpness Check
    sharpness = estimate_sharpness(image)
    if sharpness < 25.0 and "EXTREMELY_DARK" not in flags:
        flags.append("BLURRY")
        reasons.append("Image appears blurry. Clear photos help recipients verify safety.")
        quality_score -= 0.20

    # 4. Compute Perceptual Hashes
    d_hash = compute_dhash(image)
    a_hash = compute_ahash(image)

    # 5. Check for duplicates against existing database listings
    duplicate_found = False
    closest_distance = 64
    matched_hash = None

    for item in existing_hashes:
        candidate_hash = item.get("dHash") if isinstance(item, dict) else item
        if not candidate_hash:
            continue
        dist = hamming_distance(d_hash, candidate_hash)
        if dist < closest_distance:
            closest_distance = dist
            matched_hash = candidate_hash

    # Hamming distance <= 6 out of 64 bits represents identical or nearly identical image
    if closest_distance <= 6:
        duplicate_found = True
        flags.append("DUPLICATE_SUSPECTED")
        reasons.append(f"High visual similarity to an existing listing (Hamming distance: {closest_distance}/64). Please take a fresh photo.")
        quality_score -= 0.40

    quality_score = max(0.0, min(1.0, quality_score))

    # Overall Status Determination
    if duplicate_found:
        status = "warning"
        message = "Duplicate image detected. Reusing old or stock images may delay recipient acceptance."
        verified = False
    elif quality_score < 0.5:
        status = "warning"
        message = "Image quality is sub-optimal. " + " ".join(reasons)
        verified = False
    elif flags:
        status = "verified_with_notes"
        message = "Photo verified with minor warnings. " + " ".join(reasons)
        verified = True
    else:
        status = "verified"
        message = "Fresh, clear photo successfully verified by Foodshare Vision."
        verified = True

    return {
        "verified": verified,
        "status": status,
        "score": round(quality_score, 2),
        "dHash": d_hash,
        "aHash": a_hash,
        "sharpness": round(sharpness, 1),
        "brightness": round(mean_brightness, 1),
        "dimensions": f"{width}x{height}",
        "duplicateDetected": duplicate_found,
        "closestHammingDistance": closest_distance if duplicate_found else None,
        "flags": flags,
        "reasons": reasons,
        "message": message
    }

