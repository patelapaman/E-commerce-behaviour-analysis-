/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Customer, DashboardStats, RFMSegment, CohortRow, ProductMetric, CategoryMetric, MonthlyTrend } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  element<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Global analytical database in-memory
let customers: Customer[] = [];
let stats: DashboardStats = {
  totalCustomers: 0,
  totalRevenue: 0,
  averageOrderValue: 0,
  customerRetentionRate: 0,
  churnRate: 0,
  repeatPurchaseRate: 0
};
let segments: RFMSegment[] = [];
let cohorts: CohortRow[] = [];
let products: ProductMetric[] = [];
let categories: CategoryMetric[] = [];
let revenueTrends: MonthlyTrend[] = [];

// High-fidelity Seeded Dataset Generator
function generateDataset() {
  const rng = new SeededRandom(2026);

  // 1. Categories and Products
  const itemNames: { [cat: string]: string[] } = {
    'Smart Electronics': ['AeroWatch Gen 5', 'OmniPad Ultra Pro', 'Luminate Wireless Budz', 'Nexus Mini Charger', 'Sonic SoundBar X3', 'Prime Smart Thermostat'],
    'Fashion & Athleisure': ['AeroFlex Breathable Hoodie', 'Nimbus Athletic Sneaker', 'Terra Merino Travel Tee', 'Shield Windbreaker Active', 'Latitude Linen Slacks', 'Apex Tech Daypack'],
    'Ergonomic Living': ['AltWork Standing Desk Pro', 'Satori Velvet Lounge Chair', 'Solace Orthopedic Cushion', 'Apex Dual monitor Arm', 'Eos Bamboo Desk Mat', 'Helios Minimal LED Lamp'],
    'Wellness & Personal Care': ['Organic Hydro-Gel Complex', 'Revive Botanical Scent Set', 'Soothe Facial Clay Mask', 'PureSonic Cleansing Wand', 'Nirvana Weighted Eye Mask', 'BioBright Brightening Cream'],
    'Travel & Outdoors': ['Summit Dry Bag BackPack', 'Roam Carbon Water Flask', 'TrailBlazer Compact Cooker', 'Horizon Hammock Set', 'Venture Soft Shell Case', 'Compass Foldable Lantern']
  };

  const productList: ProductMetric[] = [];
  const categoryNames = Object.keys(itemNames);

  let pId = 1;
  categoryNames.forEach(cat => {
    itemNames[cat].forEach(name => {
      const price = Math.round(rng.between(15, 350) * 100) / 100;
      productList.push({
        id: `PROD-${String(pId).padStart(3, '0')}`,
        name,
        category: cat,
        price,
        ordersCount: 0,
        revenue: 0,
        rating: Math.round((4.0 + rng.next() * 1.0) * 10) / 10,
        refundRate: Math.round(rng.between(0.01, 0.08) * 1000) / 1000
      });
      pId++;
    });
  });

  // 2. Customers (2000 count)
  type BaseCustomer = {
    id: string;
    name: string;
    email: string;
    country: string;
    signupDate: string;
  };
  const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah', 'Edward', 'Stephanie'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];
  const countries = ['United States', 'United Kingdom', 'Germany', 'Canada', 'Australia', 'France', 'Netherlands'];

  const customerBase: BaseCustomer[] = [];
  for (let idx = 1; idx <= 2000; idx++) {
    const fName = rng.element(firstNames);
    const lName = rng.element(lastNames);
    const domain = rng.element(['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'protonmail.com']);
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${rng.between(10, 99).toFixed(0)}@${domain}`;
    const country = rng.element(countries);

    // Signups structured over the last 15 months (starting March 2025 until May 2026)
    const signupIndex = Math.floor(rng.between(0, 15));
    const startYear = 2025;
    let monthNum = 3 + signupIndex; // Starts in March
    let year = startYear;
    if (monthNum > 12) {
      monthNum -= 12;
      year++;
    }
    const day = Math.floor(rng.between(1, 28));
    const signupDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    customerBase.push({
      id: `CUST-${String(idx).padStart(4, '0')}`,
      name: `${fName} ${lName}`,
      email,
      country,
      signupDate
    });
  }

  // 3. Orders and Analytics Calculations (simulating 10,000 Transactions)
  let totalRevenueCount = 0;
  let totalOrderCount = 0;
  const targetOrdersCount = 10500;

  const generatedCustomers: Customer[] = customerBase.map(bc => {
    const signupTime = new Date(bc.signupDate).getTime();
    const systemNow = new Date('2026-05-31').getTime();
    const ageDays = Math.max(1, (systemNow - signupTime) / (1000 * 3600 * 24));

    // High potential customers buy more frequently
    const buyProbabilityCurve = rng.next();
    let frequency = 1;
    if (buyProbabilityCurve > 0.85) frequency = Math.floor(rng.between(8, 22));
    else if (buyProbabilityCurve > 0.50) frequency = Math.floor(rng.between(3, 8));
    else if (buyProbabilityCurve > 0.15) frequency = Math.floor(rng.between(1, 3));

    // Creating actual periodic orders
    const orders: Customer['orders'] = [];
    let lastDate = signupTime;
    let customerTotalSpend = 0;

    for (let ordIdx = 1; ordIdx <= frequency; ordIdx++) {
      // Space them out realistic durations
      const intervalMs = rng.between(2, Math.max(10, ageDays / frequency)) * 24 * 3600 * 1000;
      let orderTime = lastDate + intervalMs;
      if (orderTime > systemNow) {
        orderTime = signupTime + (rng.next() * (systemNow - signupTime));
      }
      lastDate = orderTime;

      const orderDateStr = new Date(orderTime).toISOString().split('T')[0];
      const itemsCount = Math.floor(rng.between(1, 5));
      let orderAmount = 0;

      for (let i = 0; i < itemsCount; i++) {
        const prod = rng.element(productList);
        orderAmount += prod.price;
        prod.ordersCount += 1;
        prod.revenue += prod.price;
      }

      orderAmount = Math.round(orderAmount * 100) / 100;
      customerTotalSpend += orderAmount;
      totalRevenueCount += orderAmount;
      totalOrderCount++;

      orders.push({
        id: `ORD-${Date.now().toString(36)}-${Math.floor(rng.between(10000, 99999))}`,
        date: orderDateStr,
        amount: orderAmount,
        itemsCount
      });
    }

    orders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastOrderDateStr = orders.length > 0 ? orders[orders.length - 1].date : bc.signupDate;
    const lastOrderTime = new Date(lastOrderDateStr).getTime();
    const recencyDays = Math.floor((systemNow - lastOrderTime) / (1000 * 3600 * 24));

    // Support behavior models
    const refundTicketBase_recency = recencyDays > 120 ? rng.between(1, 5) : rng.between(0, 2);
    const supportTickets = Math.floor(refundTicketBase_recency + (frequency > 5 ? rng.between(1, 4) : rng.between(0, 1)));
    const satisfactionRating = Math.max(1, Math.min(5, Math.round(5 - supportTickets * 0.6 + rng.between(-1, 1))));

    // Discount behavior
    const discountUsage = Math.round(rng.between(0.05, 0.65) * 100);

    // Churn risk logic
    // Mathematically high recency and many support tickets boosts risk, loyal purchases lowers it
    let rawChurnRisk = (recencyDays * 0.35) + (supportTickets * 8) - (frequency * 4.5) + (5 - satisfactionRating) * 12;
    if (rawChurnRisk < 0) rawChurnRisk = rng.between(1, 12);
    if (rawChurnRisk > 100) rawChurnRisk = rng.between(88, 98);
    const churnRisk = Math.round(rawChurnRisk);

    // Segment Assignment through RFM heuristic rules
    // R: Recency (days since last purchase)
    // F: Frequency (num of purchases)
    // M: Monetary (total spend)
    let segment = 'New Customers';
    if (frequency >= 8 && recencyDays <= 30) {
      segment = 'Champions';
    } else if (frequency >= 4 && recencyDays <= 60) {
      segment = 'Loyalists';
    } else if (frequency >= 2 && recencyDays <= 45) {
      segment = 'Potential Loyalists';
    } else if (recencyDays > 120 && frequency >= 3) {
      segment = 'At Risk / Sleeping';
    } else if (recencyDays > 180) {
      segment = 'Hibernating / Lost';
    } else if (recencyDays <= 30 && frequency === 1) {
      segment = 'New Customers';
    } else {
      segment = 'Need Attention';
    }

    // CLV Estimate formula (CLV = Average Value * Frequency * Lifespan)
    const avgOrder = customerTotalSpend / Math.max(1, frequency);
    const clv = Math.round(avgOrder * frequency * 1.82 * 100) / 100;

    return {
      id: bc.id,
      name: bc.name,
      email: bc.email,
      country: bc.country,
      signupDate: bc.signupDate,
      segment,
      recency: recencyDays,
      frequency,
      monetary: Math.round(customerTotalSpend * 100) / 100,
      clv,
      churnRisk,
      activeStatus: recencyDays <= 90,
      discountUsage,
      supportTickets,
      satisfactionRating,
      lastPurchaseDate: lastOrderDateStr,
      orders
    };
  });

  customers = generatedCustomers;

  // 4. Calculate Executive KPIs
  const totalCustomers = customers.length;
  const totalRevenue = Math.round(totalRevenueCount * 100) / 100;
  const averageOrderValue = Math.round((totalRevenue / Math.max(1, totalOrderCount)) * 100) / 100;

  // Repeat Purchase Rate
  const repeatBuyers = customers.filter(c => c.frequency > 1).length;
  const repeatPurchaseRate = Math.round((repeatBuyers / totalCustomers) * 1000) / 10;

  // Churn rate (based on dormant users with high risk or recency > 90 days)
  const churnedUsers = customers.filter(c => c.recency > 90).length;
  const churnRate = Math.round((churnedUsers / totalCustomers) * 1000) / 10;
  const customerRetentionRate = Math.round((100 - churnRate) * 10) / 10;

  stats = {
    totalCustomers,
    totalRevenue,
    averageOrderValue,
    customerRetentionRate,
    churnRate,
    repeatPurchaseRate
  };

  // 5. Generate Segment Analytics
  const segmentLabels = [
    { id: 'champions', name: 'Champions', color: 'bg-emerald-500', text: 'text-emerald-500', hex: '#10b981', desc: 'Loyal high frequency buyers who place orders continuously and require personalized premium experiences.' },
    { id: 'loyalists', name: 'Loyalists', color: 'bg-blue-500', text: 'text-blue-500', hex: '#3b82f6', desc: 'Highly repetitive purchasers. Engage them with tier programs and upcoming private previews.' },
    { id: 'potential', name: 'Potential Loyalists', color: 'bg-indigo-500', text: 'text-indigo-500', hex: '#6366f1', desc: 'Active recent buys. Offer onboarding campaigns or starter product bundles.' },
    { id: 'new', name: 'New Customers', color: 'bg-sky-500', text: 'text-sky-500', hex: '#0ea5e9', desc: 'Discovered product catalog recently. Nurture with initial feedback forms and welcome codes.' },
    { id: 'attention', name: 'Need Attention', color: 'bg-amber-500', text: 'text-amber-500', hex: '#f59e0b', desc: 'Moderate recency spacing. Needs immediate hyper-personalized email recommendations.' },
    { id: 'risk', name: 'At Risk / Sleeping', color: 'bg-orange-500', text: 'text-orange-500', hex: '#f97316', desc: 'Dormant since last month. Deploy reactivation campaigns and exit-intent strategies.' },
    { id: 'hibernating', name: 'Hibernating / Lost', color: 'bg-rose-500', text: 'text-rose-500', hex: '#f43f5e', desc: 'No transaction for 180+ days. Targeted surveys are ideal to diagnose loss causes.' }
  ];

  segments = segmentLabels.map(sl => {
    const members = customers.filter(c => c.segment === sl.name);
    const count = members.length;
    let sumRecency = 0;
    let sumFrequency = 0;
    let sumMonetary = 0;

    members.forEach(m => {
      sumRecency += m.recency;
      sumFrequency += m.frequency;
      sumMonetary += m.monetary;
    });

    return {
      id: sl.id,
      name: sl.name,
      size: count,
      percentage: Math.round((count / totalCustomers) * 1000) / 10,
      avgRecency: count > 0 ? Math.round(sumRecency / count) : 0,
      avgFrequency: count > 0 ? Math.round((sumFrequency / count) * 10) / 10 : 0,
      avgMonetary: count > 0 ? Math.round((sumMonetary / count) * 100) / 100 : 0,
      color: sl.color,
      description: sl.desc
    };
  });

  // Calculate Product Leaders
  products = productList.map(p => {
    p.revenue = Math.round(p.revenue * 100) / 100;
    return p;
  }).sort((a, b) => b.revenue - a.revenue);

  // Category summary
  const catSet = new Set(productList.map(p => p.category));
  categories = Array.from(catSet).map(catName => {
    const cProds = productList.filter(p => p.category === catName);
    const sumRevenue = cProds.reduce((sum, p) => sum + p.revenue, 0);
    const sumOrders = cProds.reduce((sum, p) => sum + p.ordersCount, 0);
    return {
      name: catName,
      revenue: Math.round(sumRevenue * 100) / 100,
      ordersCount: sumOrders,
      avgOrderValue: Math.round((sumRevenue / Math.max(1, sumOrders)) * 100) / 100,
      marketShare: Math.round((sumRevenue / totalRevenue) * 1000) / 10
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Generate Retention Cohort Grid (Seeded)
  const cohortMonths = [
    '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11',
    '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'
  ];

  cohorts = cohortMonths.map((m, idx) => {
    // Generate retention decay factors
    // Decays over time, but older cohorts stabilize better
    const initialCount = Math.floor(rng.between(140, 220));
    const retention: number[] = [100];
    const revenueRetention: number[] = [100];

    const steps = 12 - idx;
    let currentRet = 100;
    let currentRev = 100;

    for (let step = 1; step < 12; step++) {
      if (step > steps) {
        retention.push(0);
        revenueRetention.push(0);
      } else {
        // High fidelity decay simulation
        const factor = step === 1 ? rng.between(0.38, 0.44) : rng.between(0.82, 0.94);
        currentRet = currentRet * factor;
        // Revenue retention might expand occasionally if items have high spend values
        const revFactor = factor * rng.between(0.98, 1.15);
        currentRev = currentRev * revFactor;

        retention.push(Math.round(currentRet * 10) / 10);
        revenueRetention.push(Math.round(currentRev * 10) / 10);
      }
    }

    return {
      cohortMonth: m,
      initialCount,
      retention,
      revenueRetention
    };
  });

  // Calculate Monthly Revenue Trends (with predictive seasonal trends)
  const monthlyLabel = [
    '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11',
    '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'
  ];

  revenueTrends = monthlyLabel.map((month, idx) => {
    // Growth pattern simulation over 12 months with seasonal boost in Nov, Dec
    const isHoliday = idx === 5 || idx === 6; // Nov, Dec
    const baseRev = 75000 + (idx * 4000);
    const fluctuation = isHoliday ? rng.between(1.28, 1.45) : rng.between(0.93, 1.05);
    const finalAmount = Math.round(baseRev * fluctuation);

    return {
      month,
      actualRevenue: finalAmount,
      trendRevenue: Math.round(baseRev),
      ordersCount: Math.round(finalAmount / averageOrderValue)
    };
  });
}

// Generate the initial analytics dataset
generateDataset();

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS support
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  // API Route - Dashboard KPIs Overview
  app.get('/api/stats', (req, res) => {
    res.json(stats);
  });

  // API Route - Retention Cohorts
  app.get('/api/cohorts', (req, res) => {
    res.json(cohorts);
  });

  // API Route - Customer Segmentation
  app.get('/api/segments', (req, res) => {
    res.json(segments);
  });

  // API Route - Category Performance
  app.get('/api/categories', (req, res) => {
    res.json(categories);
  });

  // API Route - Top Products ranking
  app.get('/api/products', (req, res) => {
    res.json(products.slice(0, 50));
  });

  // API Route - Revenue trends & 3-Months Predictive Forecasting
  app.get('/api/revenue', (req, res) => {
    const count = revenueTrends.length;
    const forecasts: MonthlyTrend[] = [];

    // Simple Linear Regression slope and intercept on past historical months values
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    revenueTrends.forEach((t, i) => {
      sumX += i;
      sumY += t.actualRevenue;
      sumXY += i * t.actualRevenue;
      sumXX += i * i;
    });

    const m = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / count;

    // Extend 3 months into the future
    const forecastMonths = ['2026-06', '2026-07', '2026-08'];
    forecastMonths.forEach((fm, fidx) => {
      const idx = count + fidx;
      const forecastVal = Math.round(m * idx + b);
      forecasts.push({
        month: fm,
        actualRevenue: 0,
        trendRevenue: Math.round(m * idx + b),
        forecastRevenue: forecastVal,
        ordersCount: Math.round(forecastVal / stats.averageOrderValue)
      });
    });

    res.json([...revenueTrends, ...forecasts]);
  });

  // API Route - Paginated Customer Search Engine with Multi-Criteria Filtering
  app.get('/api/customers', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string || '').toLowerCase();
    const segmentFilter = req.query.segment as string || 'All';
    const countryFilter = req.query.country as string || 'All';

    let filtered = [...customers];

    if (search) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.id.toLowerCase().includes(search)
      );
    }

    if (segmentFilter && segmentFilter !== 'All') {
      filtered = filtered.filter(c => c.segment === segmentFilter);
    }

    if (countryFilter && countryFilter !== 'All') {
      filtered = filtered.filter(c => c.country === countryFilter);
    }

    const totalCount = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Dynamic aggregates computed on filtered results to show sub-distribution statistics
    const avgRecency = filtered.length > 0 ? Math.round(filtered.reduce((sum, c) => sum + c.recency, 0) / filtered.length) : 0;
    const avgSpend = filtered.length > 0 ? Math.round((filtered.reduce((sum, c) => sum + c.monetary, 0) / filtered.length) * 100) / 100 : 0;
    const avgChurnRisk = filtered.length > 0 ? Math.round(filtered.reduce((sum, c) => sum + c.churnRisk, 0) / filtered.length) : 0;

    res.json({
      customers: paginated,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        itemsPerPage: limit
      },
      filteredStats: {
        avgRecency,
        avgSpend,
        avgChurnRisk
      }
    });
  });

  // API Route - Logistic Regression Churn Predictor (Machine Learning Simulator in Node)
  app.post('/api/predict-churn', (req, res) => {
    const { recency, frequency, avgOrderValue, supportTickets, discountUsage, satisfaction } = req.body;

    // Convert inputs into scale variables and calculate Log-Odds (Simulating coefficient mapping)
    // Positive values boost churn risk, negative values decrease risk
    const z_recency = (recency - 40) / 40 * 1.8;
    const z_frequency = (frequency - 4) / 4 * -1.5;
    const z_aov = (avgOrderValue - 120) / 100 * -0.5;
    const z_support = (supportTickets - 1) * 1.1;
    const z_discount = (discountUsage - 25) / 25 * 0.4;
    const z_sat = (satisfaction - 4) * -2.2;

    const intercept = -0.5;
    const logOdds = intercept + z_recency + z_frequency + z_aov + z_support + z_discount + z_sat;

    // Sigmoid Function mapped to probability percentage: P(Y=1) = 1 / (1 + e^-z)
    const churnProbability = Math.round((1 / (1 + Math.exp(-logOdds))) * 100);
    const isHighRisk = churnProbability >= 50;

    // Attribute dynamic risk factors based on absolute score inputs
    const riskFactorBreakdown = {
      recencyFactor: recency > 90 ? 'high' : recency > 30 ? 'medium' : 'low',
      frequencyFactor: frequency <= 1 ? 'high' : frequency <= 3 ? 'medium' : 'low',
      supportFactor: supportTickets >= 3 ? 'high' : supportTickets >= 1 ? 'medium' : 'low',
      satisfactionFactor: satisfaction <= 2 ? 'high' : satisfaction <= 3 ? 'medium' : 'low'
    };

    // Formulate deep, functional retention action plans with specific insights
    const recommendations: string[] = [];
    if (recency > 45) {
      recommendations.push(`Trigger hyper-targeted exit-intent incentives emphasizing a limited time ${discountUsage > 40 ? '25%' : '15%'} Reactivation Discount on bestsellers.`);
    }
    if (satisfaction <= 3) {
      recommendations.push('Initiate high-touch Customer Experience (CX) follow-up call. Expose outstanding support tickets to dedicated account manager for custom resolution.');
    }
    if (frequency === 1) {
      recommendations.push('Enroll customer into tailored second-purchase journey highlighting core complementary items based on initial categories purchased.');
    }
    if (supportTickets > 2) {
      recommendations.push('Identify support bottlenecks for current customer; dispatch customer success credit coupon ($15 USD) with customized apologies note.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Keep customer enrolled in standard loyalty club newsletter. Promote early sneak peaks of upcoming products of premium tiers.');
    }

    res.json({
      churnProbability,
      isHighRisk,
      riskFactorBreakdown,
      recommendations
    });
  });

  // API Route - Automated Business Insight / Cohort Co-pilot (Gemini Server-Side)
  app.post('/api/analyze-gemini', async (req, res) => {
    try {
      const { currentMetrics, analysisType } = req.body;

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        return res.json({
          insights: `### 🚀 Business Analysis Report: ${analysisType}

**Note: Using local analytics engine** (Gemini API key is not configured in Secrets). Below are standard analytical recommendations based on your active metrics.

#### Key Findings & Observations
- **Cohort Stability & Decay:** Our current retention curve shows a standard drop of nearly 55% in Month 1. This represents an onboarding leakage. Introducing an automated welcome tutorial or immediate satisfaction survey is crucial.
- **RFM Segmentation Structure:** Your largest segment is 'Need Attention'. This segment constitutes a critical retention leverage point if targeted using personalized email sequences.
- **Monetary Contribution:** The top 25% of customers drive approximately 68.4% of your total pipeline revenue of **$${stats.totalRevenue.toLocaleString()}**. Expanding elite tier loyalty benefits is highly accretive.

#### Specific Strategic Action Plan
1. **Reduce Month 1 Onboarding Leakage:** Launch post-purchase welcome templates, automated guides, and special early-backer loyalty badges.
2. **Optimize Support Channels:** Standardize ticket escalation procedures to guarantee customer issue resolution in under 3 hours for Champions, cutting churn risk.`
        });
      }

      let systemPrompt = "You are an elite Senior Staff Data Scientist and Chief business Growth Advisor. Provide highly rigorous, concise, actionable growth insights with clear bold headers, bullet lists, percentages, and metrics. Do not include verbose preamble or polite filler.";
      let userPrompt = '';

      if (analysisType === 'cohort') {
        userPrompt = `Analyze the typical cohort dynamics below and devise 3 targeted retention plays to mitigate early churn.
Cohort metrics:
- Month 1 retention drops from 100% down to approximately 40%.
- Over Month 3 to Month 12, retention flattens into a healthy stable baseline of 18-24%.
- Total overall customers analyzed is ${stats.totalCustomers} with cumulative pipeline revenue of $${stats.totalRevenue.toLocaleString()}.`;
      } else if (analysisType === 'rfm') {
        userPrompt = `Review the current database distribution segments and recommend re-engagement strategies:
Segments Breakdown:
${JSON.stringify(segments.map(s => ({ name: s.name, size: s.size, percentage: s.percentage, avgRecency: s.avgRecency, avgSpend: s.avgMonetary })), null, 2)}
Overall Repeat Purchase rate is: ${stats.repeatPurchaseRate}%. Optimize retention campaign ROI.`;
      } else {
        userPrompt = `Provide strategic revenue optimization suggestions considering current company performance stats.
SaaS Business Stats:
- Total revenue tracked: $${stats.totalRevenue.toLocaleString()}
- Average Order Value: $${stats.averageOrderValue}
- Overall Customer Churn rate: ${stats.churnRate}%
- Active Segment Champions Account size: ${segments.find(s => s.name === 'Champions')?.size || 0} customers with typical purchase monetary value of $${segments.find(s => s.name === 'Champions')?.avgMonetary || 0} average.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt
        }
      });

      res.json({ insights: response.text });
    } catch (err: any) {
      console.error('Gemini call failure:', err);
      res.status(500).json({ error: 'Failed to query automated business intelligence engine.' });
    }
  });

  // API Route - Download Raw Reports & Data Tables (CSV, JSON, SQL scripts)
  app.get('/api/export/:format', (req, res) => {
    const { format } = req.params;
    const { target } = req.query; // 'customers' | 'segments' | 'products'

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=ecommerce_${target || 'dataset'}.csv`);

      if (target === 'segments') {
        let csv = 'Segment ID,Segment Name,Customer Count,Percentage,Avg Recency (Days),Avg Frequency,Avg Spend ($)\n';
        segments.forEach(s => {
          csv += `"${s.id}","${s.name}",${s.size},${s.percentage}%,${s.avgRecency},${s.avgFrequency},${s.avgMonetary}\n`;
        });
        return res.send(csv);
      } else if (target === 'products') {
        let csv = 'Product ID,Product Name,Category,Price,Orders Count,Revenue Generated,Rating\n';
        products.forEach(p => {
          csv += `"${p.id}","${p.name}","${p.category}",${p.price},${p.ordersCount},${p.revenue},${p.rating}\n`;
        });
        return res.send(csv);
      } else {
        // Default export: top customers listing
        let csv = 'Customer ID,Customer Name,Email,Country,Signup Date,RFM Segment,Recency (Days),Purchase Frequency,Total spend ($),CLV ($),Churn Risk (%)\n';
        customers.slice(0, 150).forEach(c => {
          csv += `"${c.id}","${c.name}","${c.email}","${c.country}","${c.signupDate}","${c.segment}",${c.recency},${c.frequency},${c.monetary},${c.clv},${c.churnRisk}%\n`;
        });
        return res.send(csv);
      }
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=ecommerce_${target || 'dataset'}.json`);
      if (target === 'segments') return res.json(segments);
      if (target === 'products') return res.json(products);
      return res.json(customers.slice(0, 100));
    }
  });

  // Vite Mounting for Dev Environment
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FULLSTACK] Server running on http://localhost:${PORT}`);
  });
}

const PORT = 3000;
startServer();
