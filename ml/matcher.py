"""
Foodshare - Intelligent Matching & Recommendation Engine
Ranks food listings for recipients based on:
1. Distance Proximity (Haversine decay)
2. Expiry Urgency (prioritizing food rescue before waste)
3. Quantity Suitability (matching portions to recipient need)
4. Donor Reliability (historical rating & fulfillment score)
5. Dietary & Storage Compatibility (allergens, dietary tags, refrigeration)
"""

import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in km."""
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def parse_iso_datetime(dt_str: Any) -> Optional[datetime]:
    """Safely parses ISO datetime string to timezone-aware datetime."""
    if not dt_str:
        return None
    if isinstance(dt_str, datetime):
        return dt_str if dt_str.tzinfo else dt_str.replace(tzinfo=timezone.utc)
    try:
        s = str(dt_str).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

def calculate_match(recipient: Dict[str, Any], listing: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes a multi-factor AI match score between a recipient and a food listing.
    """
    now = datetime.now(timezone.utc)
    reasons = []
    breakdown = {}

    # Extract Recipient Preferences & Geo
    rec_lat = recipient.get("lat")
    rec_lng = recipient.get("lng")
    rec_requested_portions = max(1, int(recipient.get("requestedPortions") or 4))
    rec_allergies = [a.strip().lower() for a in (recipient.get("allergies") or [])]
    rec_dietary = [d.strip().lower() for d in (recipient.get("dietaryPreferences") or [])]
    rec_storage_cap = (recipient.get("storageCapacity") or "all").lower()

    # Extract Listing Info
    loc = listing.get("location") or {}
    coords = loc.get("coordinates") or []
    # GeoJSON format is [longitude, latitude]
    list_lng = coords[0] if len(coords) > 0 else listing.get("lng")
    list_lat = coords[1] if len(coords) > 1 else listing.get("lat")

    remaining_qty = float(listing.get("remainingQuantity") or listing.get("quantity") or 1)
    expires_at = parse_iso_datetime(listing.get("expiresAt"))
    allergens = [a.strip().lower() for a in (listing.get("allergens") or [])]
    dietary_tags = [d.strip().lower() for d in (listing.get("dietaryTags") or [])]
    storage_condition = str(listing.get("storageCondition") or "ambient").lower()

    donor_info = listing.get("donor") or {}
    if isinstance(donor_info, str):
        donor_info = {}
    donor_reliability = float(donor_info.get("reliabilityScore") or 4.8)

    # 1. Distance Score (0.0 to 1.0)
    distance_km = None
    if rec_lat is not None and rec_lng is not None and list_lat is not None and list_lng is not None:
        try:
            distance_km = haversine_distance_km(float(rec_lat), float(rec_lng), float(list_lat), float(list_lng))
            # Exponential decay: 0km => 1.0, 5km => 0.66, 12km => 0.37, 25km => 0.12
            distance_score = math.exp(-distance_km / 12.0)
            if distance_km < 2.0:
                reasons.append(f"Ultra-close ({distance_km:.1f} km away)")
            elif distance_km < 5.0:
                reasons.append(f"Nearby ({distance_km:.1f} km away)")
            else:
                reasons.append(f"{distance_km:.1f} km away")
        except Exception:
            distance_score = 0.5
            distance_km = None
    else:
        distance_score = 0.6
        reasons.append("Distance calculated from city center")

    breakdown["distance"] = round(distance_score * 100, 1)

    # 2. Expiry Urgency Score (0.0 to 1.0)
    # The closer to expiry, the higher the urgency to rescue it, but 0 if expired.
    if expires_at:
        hours_left = (expires_at - now).total_seconds() / 3600.0
        if hours_left <= 0:
            urgency_score = 0.0
            reasons.append("Listing has expired")
        elif hours_left <= 6.0:
            urgency_score = 1.0 - (hours_left * 0.04) # 0.76 to 1.0
            reasons.append(f"Urgent Rescue: Expiring in {int(hours_left)}h {int((hours_left%1)*60)}m")
        elif hours_left <= 24.0:
            urgency_score = 0.75 - ((hours_left - 6.0) / 18.0) * 0.25 # 0.50 to 0.75
            reasons.append(f"Expiring today ({int(hours_left)} hours remaining)")
        elif hours_left <= 72.0:
            urgency_score = 0.50 - ((hours_left - 24.0) / 48.0) * 0.20 # 0.30 to 0.50
            reasons.append(f"Good freshness ({int(hours_left/24)} days left)")
        else:
            urgency_score = 0.25
    else:
        urgency_score = 0.5
        hours_left = None

    breakdown["urgency"] = round(urgency_score * 100, 1)

    # 3. Quantity Suitability Score (0.0 to 1.0)
    # Evaluates how well the available quantity meets the recipient's requirement
    if remaining_qty >= rec_requested_portions:
        # Full demand can be met
        qty_ratio = rec_requested_portions / remaining_qty
        # Prefer listings that aren't excessively oversized compared to request to avoid excess waste
        qty_score = 0.90 + 0.10 * (1.0 - min(1.0, (remaining_qty - rec_requested_portions) / 20.0))
        reasons.append(f"Can fulfill all {rec_requested_portions} portions ({int(remaining_qty)} available)")
    else:
        # Partial fulfillment
        fraction = remaining_qty / rec_requested_portions
        qty_score = max(0.2, fraction * 0.8)
        reasons.append(f"Partial batch ({int(remaining_qty)} of {rec_requested_portions} portions)")

    breakdown["quantity"] = round(qty_score * 100, 1)

    # 4. Donor Reliability Score (0.0 to 1.0)
    reliability_score = min(1.0, max(0.1, donor_reliability / 5.0))
    if donor_reliability >= 4.7:
        reasons.append(f"Top-rated verified donor ({donor_reliability:.1f}★)")
    breakdown["reliability"] = round(reliability_score * 100, 1)

    # 5. Dietary & Allergen Compatibility (0.0 to 1.0)
    compat_score = 0.8 # baseline neutral

    # Allergen conflict check
    allergen_conflict = False
    for allergen in allergens:
        if allergen in rec_allergies:
            allergen_conflict = True
            break

    if allergen_conflict:
        compat_score = 0.05
        reasons.append("Contains allergen matching your profile restrictions")
    else:
        # Check dietary tag match
        matched_tags = [t for t in dietary_tags if t in rec_dietary]
        if matched_tags:
            compat_score = 1.0
            reasons.append(f"Matches dietary preferences: {', '.join([t.capitalize() for t in matched_tags])}")
        elif rec_dietary:
            compat_score = 0.7

    # Storage condition check
    if rec_storage_cap != "all" and rec_storage_cap:
        if rec_storage_cap == "ambient" and storage_condition in ["refrigerated", "frozen"]:
            compat_score *= 0.5
            reasons.append(f"Requires {storage_condition} storage")

    breakdown["compatibility"] = round(compat_score * 100, 1)

    # Weighted Composite Score
    # Distance: 30%, Urgency: 25%, Quantity: 20%, Reliability: 15%, Compatibility: 10%
    w_dist = 0.30
    w_urg = 0.25
    w_qty = 0.20
    w_rel = 0.15
    w_compat = 0.10

    # If allergen conflict, heavily penalize total
    if allergen_conflict:
        final_score = compat_score * 20.0
    elif urgency_score == 0.0:
        # Expired listings should not be recommended
        final_score = 0.0
    else:
        final_score = (
            w_dist * (distance_score * 100) +
            w_urg * (urgency_score * 100) +
            w_qty * (qty_score * 100) +
            w_rel * (reliability_score * 100) +
            w_compat * (compat_score * 100)
        )

    final_score = round(max(0.0, min(100.0, final_score)), 1)

    # Badge classification
    if final_score >= 85:
        match_tier = "Excellent Match"
        tier_color = "emerald"
    elif final_score >= 70:
        match_tier = "Great Match"
        tier_color = "teal"
    elif final_score >= 50:
        match_tier = "Moderate Match"
        tier_color = "amber"
    else:
        match_tier = "Low Match"
        tier_color = "slate"

    return {
        "listingId": str(listing.get("_id") or listing.get("id")),
        "matchScore": final_score,
        "matchTier": match_tier,
        "tierColor": tier_color,
        "distanceKm": round(distance_km, 2) if distance_km is not None else None,
        "breakdown": breakdown,
        "keyReasons": reasons[:4],
        "listing": listing
    }

def rank_listings(recipient: Dict[str, Any], listings: List[Dict[str, Any]], limit: int = 20) -> List[Dict[str, Any]]:
    """
    Ranks active food listings for a given recipient using multi-factor AI scoring.
    Filters out expired listings and severe allergen conflicts, then sorts descending by matchScore.
    """
    scored = []
    for item in listings:
        # Ignore completed or already fully claimed listings
        if str(item.get("status", "available")).lower() not in ["available"]:
            continue
        res = calculate_match(recipient, item)
        if res["matchScore"] > 0:
            scored.append(res)

    # Sort by matchScore descending
    scored.sort(key=lambda x: x["matchScore"], reverse=True)
    return scored[:limit]

