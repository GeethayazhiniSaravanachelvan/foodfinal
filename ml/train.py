"""
Foodshare - Machine Learning Model Training Script
Trains a supervised Random Forest Classifier to predict:
- Food Donation Rescue Success Probability
- Optimal Recipient-to-Listing Match Quality
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

def generate_synthetic_dataset(n_samples: int = 12000, random_seed: int = 42) -> pd.DataFrame:
    np.random.seed(random_seed)

    # 1. Distance in km (0.1 to 35 km)
    distance_km = np.random.exponential(scale=6.5, size=n_samples) + 0.2
    distance_km = np.clip(distance_km, 0.2, 35.0)

    # 2. Hours left until expiration (0.5 to 72 hours)
    hours_left = np.random.exponential(scale=18.0, size=n_samples) + 0.5
    hours_left = np.clip(hours_left, 0.5, 72.0)

    # 3. Portion ratio: requested / remaining (0.1 to 2.5)
    portion_ratio = np.random.normal(loc=0.8, scale=0.35, size=n_samples)
    portion_ratio = np.clip(portion_ratio, 0.1, 2.5)

    # 4. Donor reliability score (1.0 to 5.0)
    donor_reliability = np.random.normal(loc=4.8, scale=0.3, size=n_samples)
    donor_reliability = np.clip(donor_reliability, 1.0, 5.0)

    # 5. Dietary compatibility (0.0 to 1.0)
    dietary_compatibility = np.random.choice([1.0, 0.75, 0.5, 0.0], size=n_samples, p=[0.60, 0.20, 0.15, 0.05])

    # 6. Storage compatibility (0.0, 0.5, 1.0)
    storage_compatibility = np.random.choice([1.0, 0.5, 0.0], size=n_samples, p=[0.75, 0.20, 0.05])

    # 7. Allergen safe (1 = safe, 0 = allergen conflict)
    allergen_safe = np.random.choice([1.0, 0.0], size=n_samples, p=[0.92, 0.08])

    dist_weight = -0.12 * distance_km
    urgency_weight = np.where(hours_left < 3.0, 1.5, np.where(hours_left < 8.0, 1.2, 0.5))
    portion_weight = np.where(portion_ratio <= 1.0, 0.8, -1.2 * (portion_ratio - 1.0))
    rel_weight = 0.5 * (donor_reliability - 3.0)
    diet_weight = 1.0 * dietary_compatibility
    stor_weight = 0.8 * storage_compatibility
    allergen_penalty = np.where(allergen_safe == 1.0, 0.5, -4.0)

    logit = (
        dist_weight
        + urgency_weight
        + portion_weight
        + rel_weight
        + diet_weight
        + stor_weight
        + allergen_penalty
        - 0.2
    )

    prob = 1.0 / (1.0 + np.exp(-logit))
    noise = np.random.normal(0, 0.05, size=n_samples)
    target = ((prob + noise) >= 0.5).astype(int)
    target[allergen_safe == 0.0] = 0

    df = pd.DataFrame({
        "distance_km": np.round(distance_km, 2),
        "hours_left": np.round(hours_left, 2),
        "portion_ratio": np.round(portion_ratio, 2),
        "donor_reliability": np.round(donor_reliability, 2),
        "dietary_compatibility": np.round(dietary_compatibility, 2),
        "storage_compatibility": np.round(storage_compatibility, 2),
        "allergen_safe": allergen_safe.astype(int),
        "successful_rescue": target
    })

    return df

def train_model():
    print("==========================================================")
    print(" [*] Foodshare - Training AI Matching ML Model")
    print("==========================================================")

    current_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(current_dir, "food_donation_dataset.csv")
    model_path = os.path.join(current_dir, "match_model.pkl")
    metrics_path = os.path.join(current_dir, "model_metrics.json")

    # 1. Generate / Load Dataset
    print("\n[1/4] Generating food rescue dataset (12,000 samples)...")
    df = generate_synthetic_dataset(n_samples=12000, random_seed=42)
    df.to_csv(dataset_path, index=False)
    print(f" -> Saved training dataset to: {dataset_path}")
    print(f" -> Class distribution: {df['successful_rescue'].value_counts().to_dict()}")

    # 2. Features and Target
    feature_cols = [
        "distance_km",
        "hours_left",
        "portion_ratio",
        "donor_reliability",
        "dietary_compatibility",
        "storage_compatibility",
        "allergen_safe"
    ]

    X = df[feature_cols]
    y = df["successful_rescue"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"\n[2/4] Training Random Forest Classifier on {len(X_train)} training records...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # 3. Model Evaluation
    print(f"\n[3/4] Evaluating model performance on {len(X_test)} validation records...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred))
    rec = float(recall_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred))
    roc_auc = float(roc_auc_score(y_test, y_prob))

    feature_importances = dict(zip(feature_cols, [round(float(v), 4) for v in model.feature_importances_]))
    sorted_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))

    print("==========================================================")
    print(" MODEL EVALUATION RESULTS:")
    print(f"   - Accuracy:        {acc * 100:.2f}%")
    print(f"   - Precision:       {prec * 100:.2f}%")
    print(f"   - Recall:          {rec * 100:.2f}%")
    print(f"   - F1-Score:        {f1 * 100:.2f}%")
    print(f"   - ROC-AUC Score:   {roc_auc * 100:.2f}%")
    print("==========================================================")
    print(" FEATURE IMPORTANCES:")
    for feat, imp in sorted_importances.items():
        print(f"   - {feat.ljust(25)}: {imp * 100:.2f}%")
    print("==========================================================")

    # 4. Save Model Artifacts
    print("\n[4/4] Serializing trained model to match_model.pkl...")
    joblib.dump(model, model_path, compress=3)
    print(f" -> Trained model saved: {model_path} ({os.path.getsize(model_path) // 1024} KB)")

    metrics_payload = {
        "model_type": "RandomForestClassifier",
        "library": "scikit-learn",
        "n_estimators": 100,
        "max_depth": 10,
        "total_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "feature_importances": sorted_importances,
        "features": feature_cols,
        "status": "trained_and_verified"
    }

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f" -> Metrics saved: {metrics_path}")

    print("\n[SUCCESS] ML Training Complete! Model is ready for real-time inference.\n")

if __name__ == "__main__":
    train_model()
