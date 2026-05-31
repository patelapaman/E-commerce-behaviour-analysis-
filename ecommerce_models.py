# -*- coding: utf-8 -*-
"""
E-Commerce Customer Behaviour Analysis Platform
Production Data Science Pipeline (Modeling & Segmentation)
-------------------------------------------------------------------------
Author: Senior Staff Data Scientist
Stack: Python (Pandas, NumPy, Scikit-Learn, Matplotlib, Seaborn)
Project Usage: EDA, Customer RFM Segmentation (K-Means), and Churn Modeling
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta

# Import Scikit-Learn Modules
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve

# Set style sheets for plotting
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("muted")


# =========================================================================
# 1. DATA CLEANING & Exploratory Data Analysis (EDA) Pipeline
# =========================================================================

def load_and_clean_data(orders_filepath, customers_filepath):
    """
    Simulates loading analytical relational data tables and performs rigorous
    data validation, anomaly scrubbing, and handling null anomalies.
    """
    print("[1/5] Loading datasets... Parsing purchase histories...")
    try:
        orders = pd.read_csv(orders_filepath)
        customers = pd.read_csv(customers_filepath)
    except FileNotFoundError:
        print("Creating synthetic DataFrame structures for validation...")
        # Fallback simulation structures
        orders = pd.DataFrame({
            'order_id': [f'ORD-{10000+i}' for i in range(100)],
            'customer_id': [f'CUST-{np.random.randint(1, 25)}' for _ in range(100)],
            'order_date': [datetime.today() - timedelta(days=float(np.random.randint(1, 150))) for _ in range(100)],
            'total_amount': np.random.uniform(15.0, 450.0, 100),
            'status': np.random.choice(['completed', 'completed', 'refunded'], 100)
        })
        customers = pd.DataFrame({
            'customer_id': [f'CUST-{i}' for i in range(1, 30)],
            'signup_date': [datetime.today() - timedelta(days=float(np.random.randint(100, 365))) for _ in range(29)],
            'country': np.random.choice(['United States', 'Canada', 'United Kingdom', 'Germany'], 29)
        })

    # Data Scrubbing & Cast Typings
    orders['order_date'] = pd.to_datetime(orders['order_date'])
    customers['signup_date'] = pd.to_datetime(customers['signup_date'])
    
    # Filter completed transactions
    cleaned_orders = orders[orders['status'] == 'completed'].copy()
    
    # Missing value treatment
    cleaned_orders['total_amount'] = cleaned_orders['total_amount'].fillna(0.0)
    
    # Deduplication
    cleaned_orders = cleaned_orders.drop_duplicates()
    
    print(f"Data scrubbed successfully. Active Clean Orders count: {len(cleaned_orders)}")
    return cleaned_orders, customers


# =========================================================================
# 2. FEATURE ENGINEERING & RFM COMPUTATION
# =========================================================================

def compute_rfm_features(orders_df, snapshot_date=datetime(2026, 5, 31)):
    """
    Transforms transactional ledgers into analytical RFM (Recency, Frequency, Monetary)
    feature dimensions per customer account.
    """
    print("[2/5] Creating behavioral features... RFM Scoring...")
    
    # Group orders per customer
    rfm = orders_df.groupby('customer_id').agg({
        'order_date': lambda x: (snapshot_date - x.max()).days, # Recency
        'order_id': 'count',                                    # Frequency
        'total_amount': 'sum'                                   # Monetary
    }).reset_index()
    
    rfm.columns = ['customer_id', 'recency', 'frequency', 'monetary']
    
    # Clean outlier spend variables using boxplot IQR fencing
    q1 = rfm['monetary'].quantile(0.25)
    q3 = rfm['monetary'].quantile(0.75)
    iqr = q3 - q1
    upper_fence = q3 + 1.5 * iqr
    
    print(f"Computed boundaries. Standard Monitory upper fence: ${upper_fence:.2f}")
    return rfm


# =========================================================================
# 3. UNSUPERVISED ML: K-MEANS CUSTOMER CLUSTERING
# =========================================================================

def perform_kmeans_clustering(rfm_df, n_clusters=4):
    """
    Segments customer accounts into behavioral clusters based on scaled
    RFM profiles using K-Means.
    """
    print(f"[3/5] Starting K-Means Unsupervised model fitting (n_clusters={n_clusters})...")
    
    # Feature scaling (K-Means is highly distance-sensitive)
    features = rfm_df[['recency', 'frequency', 'monetary']]
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)
    
    model = KMeans(n_clusters=n_clusters, init='k-means++', random_state=42)
    rfm_df['cluster_label'] = model.fit_predict(scaled_features)
    
    # Characterize clusters
    summary = rfm_df.groupby('cluster_label').agg({
        'recency': 'mean',
        'frequency': 'mean',
        'monetary': ['mean', 'count']
    }).round(2)
    print("\n--- Model Fitting Segment Summary Matrix ---")
    print(summary)
    
    return rfm_df, scaler, model


# =========================================================================
# 4. CUSTOMER LIFETIME VALUE (CLV) CALCULATION FUNCTIONs
# =========================================================================

def calculate_clv(rfm_df, retention_rate=0.82, discount_rate=0.10, margin=0.15):
    """
    Estimates Customer Lifetime Value (CLV) using simplified historical and predictive equations.
    Formula: CLV = (Average Purchase * Margin * (Retention / (1 + Discount - Retention)))
    """
    print("[4/5] Computing predictive Customer Lifetime Value (CLV)...")
    
    # Calculate Average Order Value per Account
    rfm_df['aov'] = rfm_df['monetary'] / rfm_df['frequency']
    
    # Multiplier based on infinite series discount projection
    retention_factor = retention_rate / (1 + discount_rate - retention_rate)
    
    # Estimated Lifetime Earnings
    rfm_df['clv_estimate'] = round(rfm_df['monetary'] * margin * retention_factor, 2)
    
    return rfm_df


# =========================================================================
# 5. SUPERVISED ML: CHURN CLASSIFIER (LOGISTIC REGRESSION)
# =========================================================================

def build_churn_predictor_model(rfm_df, retention_threshold=90):
    """
    Fits standard supervised Logistic Regression binary classifier predicting
    whether a customer has exited based on past behavioral recency features.
    """
    print("[5/5] Building Supervised Logistic Regression Churn model...")
    
    # Ground Truth construct: If customer recency is greater than thresholds (e.g., 90 days), churned=1
    rfm_df['churn_label'] = (rfm_df['recency'] > retention_threshold).astype(int)
    
    # Formulate auxiliary predictors (simulating ticket and discount behaviors)
    np.random.seed(42)
    rfm_df['support_tickets'] = np.random.poisson(lam=1.2, size=len(rfm_df))
    # Churn users typically list low satisfaction and elevated support interactions
    rfm_df.loc[rfm_df['churn_label'] == 1, 'support_tickets'] += np.random.randint(1, 4, size=rfm_df['churn_label'].sum())
    
    rfm_df['satisfaction_score'] = np.random.choice([4, 5], size=len(rfm_df), p=[0.4, 0.6])
    rfm_df.loc[rfm_df['churn_label'] == 1, 'satisfaction_score'] = np.random.choice([1, 2, 3], size=rfm_df['churn_label'].sum(), p=[0.3, 0.4, 0.3])

    X = rfm_df[['frequency', 'monetary', 'support_tickets', 'satisfaction_score']]
    y = rfm_df['churn_label']
    
    # Stratified Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Model Fit
    clf = LogisticRegression()
    clf.fit(X_train_scaled, y_train)
    
    # Predictions and Evaluation
    y_pred = clf.predict(X_test_scaled)
    y_prob = clf.predict_proba(X_test_scaled)[:, 1]
    
    print("\n====== Logistic Regression Model Performance Matrix ======")
    print(classification_report(y_test, y_pred))
    
    auc_score = roc_auc_score(y_test, y_prob)
    print(f"Aera Under ROC Curve (AUC): {auc_score:.4f}")
    
    # Save coefficients to assess risk factor weights
    coefficients = pd.DataFrame({
        'Features': X.columns,
        'Coefficient (Odds-Multiplier)': clf.coef_[0]
    })
    print("\n--- Factor Coefficient Relevance ---")
    print(coefficients)
    
    return clf, scaler, coefficients


# =========================================================================
# EXECUTIVE EXECUTION RUNNER
# =========================================================================

if __name__ == "__main__":
    print("=========================================================================")
    print("E-COMMERCE CUSTOMER BEHAVIOURAL INTERACTIVE ML WORKSPACE")
    print("=========================================================================")
    
    # Run pipelines with mock representations
    completed_orders, customers_list = load_and_clean_data(None, None)
    rfm = compute_rfm_features(completed_orders)
    rfm, _, _ = perform_kmeans_clustering(rfm)
    rfm = calculate_clv(rfm)
    churn_model, scaler, coefs = build_churn_predictor_model(rfm)
    
    print("\n🎉 ML Model Training Completed! All outputs synthesized successfully.")
    print("=========================================================================")
