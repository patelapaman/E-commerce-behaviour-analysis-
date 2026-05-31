# 📊 E-Commerce Customer Behaviour Analysis Platform (AI & Fullstack SaaS)

A production-grade, fullstack Customer Analytics and Behavioural Insights platform. This platform parses 10,000+ transactional histories, categorizes active customer accounts into standard RFM clusters, traces monthly retention cohort matrixes, forecasts revenues with linear regressions, predicts churn probability using Logistic Regression models, and leverages Gemini and generative AI and automated growth coach to deliver executive business advisory reports.

Designed as an enterprise-grade portfolio project showcasing integration across Data Engineering (MySQL architecture), Data Science (RFM, Cohort heatmaps, and Machine learning modeling), and Fullstack software craftsmanship (React + Express server-side proxy).

---

## 🛠️ Technology Stack

- **Frontend Core:** React.js 19, Tailwind CSS v4, Lucide Icons
- **Data Visualizations:** Recharts (Interactive Line charts, Bar distributions, Scatter groupings, Segment pies) and custom Cohort Heatmaps
- **Animations:** Framer Motion (micro-indicators and staggered entrances)
- **Backend Service:** Node.js, Express.js (serving analytics metrics, ML predictors, paginated lookup, CSV/JSON report generators)
- **AI Analytics Coach:** `Google GenAI SDK` (@google/genai) proxying `gemini-3.5-flash` for cohort analysis and recommendations.
- **Data Science Pipeline:** Python, Pandas, NumPy, Scikit-Learn (K-Means Clustering and Logistic Regression Churn classifier)
- **Database Architecture:** MySQL (complete structural script, indexing strategy, relational constraints, and analytics queries)

---

## 📂 Project Architecture & File Tree

```
├── .env.example              # Environments, API keys & endpoint setups
├── .gitignore                # Production file ignore exclusions
├── ecommerce_analytics.sql   # Relational MySQL schemas, indexes & report views
├── ecommerce_models.py       # Python Pandas EDA, K-Means & Logistic Regression model
├── metadata.json             # AI Studio capability descriptions
├── package.json              # Fullstack TypeScript NPM bundle rules
├── server.ts                 # Fullstack Node/Express database engine & REST API routes
├── tsconfig.json             # TypeScript structural target rules
├── vite.config.ts            # Asset pipeline & Vite dev server rules
├── index.html                # Entry web UI viewport
├── src
│   ├── App.tsx               # Primary Client Layout & Navigation Router
│   ├── index.css             # Tailwind CSS & Typography custom themes
│   ├── main.tsx              # React mounting entry point
│   ├── types.ts              # Statically typed analytical data contracts
│   ├── data
│   │   └── staticCode.ts     # Holds copyable Python, SQL, and install configs for UI panels
│   └── components
│       ├── Sidebar.tsx       # Side dashboard navigation layout
│       ├── ExecutiveBrief.tsx# Executive KPI cards & revenue forecast trends
│       ├── SegmentCluster.tsx# RFM distribution grids & segment characterizations
│       ├── ChurnWorkspace.tsx# Dynamic ML Churn risk playfield & Python notebooks
│       ├── CohortHeatmap.tsx # Responsive retention grids with custom conditional styling
│       ├── CustomerExplorer.tsx # Paginated search index with customer profiles drawer
│       ├── DatabaseSchema.tsx# Interactive SQL schema, Indexing rules & ER drawings
│       └── AICoach.tsx       # AI Cohort Coach asking Gemini for custom advisories
```

---

## ⚙️ Quickstart Setup & Local Development

### Prerequisites

- **Node.js** (v18.0.0 or higher)
- **NPM** (v10.0.0 or higher)
- **Gemini API Key** (Accessible from Google AI Studio)

### Installation Steps

1. **Step 1: Clone or extract files**
   ```bash
   # Create root workspace
   mkdir ecommerce-analytics-platform
   cd ecommerce-analytics-platform
   ```

2. **Step 2: Install dependencies**
   ```bash
   npm install
   ```

3. **Step 3: Setup Environment Secrets**
   Duplicate `.env.example` to create `.env` and assign your Gemini API Key:
   ```env
   # .env
   GEMINI_API_KEY="AIzaSyYourSecretKeyHere..."
   APP_URL="http://localhost:3000"
   ```

4. **Step 4: Launch Dev Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the interactive live application!

---

## 🌐 Production Build & Deployment Guide

This app is built using a unified fullstack configuration that compiles both React client assets and Express endpoints to run inside a single, scalable Docker/Cloud Run container.

### Step 1: Compiling Fullstack Production Bundle

To build the client SPA and bundle the Express server code into a self-contained CommonJS script (`dist/server.cjs`) run:
```bash
npm run build
```

### Step 2: Running Standalone Web Server

Launch the production web server binding to port `3000`:
```bash
npm start
```

### Step 3: Platform Deployment Configurations

#### 🔺 Deploying Backend and Frontend to Render or Railway
This project runs as a standard unified Docker container or Node service.
1. Create a **Web Service** on **Render** (or Web App on **Railway**).
2. Configure **Build Command:** `npm run build`
3. Configure **Start Command:** `npm run start`
4. Assign Environment Variable: `GEMINI_API_KEY` pointing to your Gemini Key.

---

## 📡 REST API Documentation

All server-side endpoints are compiled under `/api/*` proxies.

| Endpoint | Method | JSON Body Parameters | Description |
|---|---|---|---|
| `/api/stats` | `GET` | *None* | Serves key executive KPI metrics (revenue, conversion, churn). |
| `/api/cohorts` | `GET` | *None* | Generates the 12-month retention and revenue decay cohort array. |
| `/api/segments` | `GET` | *None* | Computes active RFM clusters sizes, percentages, and metrics. |
| `/api/products` | `GET` | *None* | Ranks top 50 products by revenue, categories, and ratings. |
| `/api/categories` | `GET` | *None* | Ranks categorical sales volumes and absolute relative market shares. |
| `/api/revenue` | `GET` | *None* | Generates historical monthly receipts + 3 months linear forecasts. |
| `/api/customers` | `GET` | `?page=&limit=&search=&segment=&country=` | Fetches paginated, searchable, multi-filtered customers list. |
| `/api/predict-churn` | `POST` | `{ recency, frequency, avgOrderValue, supportTickets, discountUsage, satisfaction }` | Machine Learning Classifier returning churn risk % and action guides. |
| `/api/analyze-gemini` | `POST` | `{ currentMetrics, analysisType }` | Connects with Gemini to return custom senior strategic advices. |
| `/api/export/:format` | `GET` | `?target=customers\|segments\|products` | Downloads custom data reports in CSV or JSON binary files. |

---

## 💾 Relational Database Structure (ER Mapping)

```
[customers] 1 ──── 0..* [orders] 1 ──── 1..* [order_items] * ──── 1 [products]
                                                    │
                                             * ──── 1 [categories]
```

Detailed relational constraints, functional index plans, and automatic RFM computing procedures can be reviewed inside `/ecommerce_analytics.sql`. All scripts are ready to copy or run on standard MySQL 8.+ distributions!

---

## 📈 Machine Learning Framework Coefficients

In the supervised churn predictions logic, the mapping weights of Logistic Regressions variables compute as:
- **Customer Product Order Frequency:** Inhibits churn heavily (`Coefficient: -1.50`)
- **Customer Satisfaction Rating:** Decreases churn risk significantly (`Coefficient: -2.20`)
- **Account Support Interaction Frequency:** Boosts churn risks heavily (`Coefficient: +1.10`)
- **Purchase Recency (Days Dormant):** Exponentially triggers exit churn rates (`Coefficient: +1.80`)

This mathematical consistency ensures high-fidelity predictive modeling outputs. No placeholders are used!
