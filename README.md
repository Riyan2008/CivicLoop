# CivicLoop — "From Complaints to Action" 🏛️⚡

> **A Production-Grade Civic Tech Prototype**  
> Bridging citizen complaints and municipal action with automated AI triage, duplicate detection, explainable prioritization, hotspot clustering, and a tokenized Civic Wallet incentive system.

---

## 🌟 Executive Summary & Hackathon Context

Civic complaints systems frequently suffer from three structural bottlenecks:
1. **Complaint Fatigue & Spam:** Citizens report duplicate issues without feedback, flooding municipal desks with redundant tickets.
2. **Prioritization Paralysis:** Low-risk issues (e.g. unpainted curbs) obscure life-safety emergencies (e.g. live sparking wires, sinkholes outside schools).
3. **Lack of Citizen Closure & Incentives:** Citizens rarely receive tangible feedback or motivation to verify resolutions.

**CivicLoop** solves this through an end-to-end feedback loop:
- **Under-a-Minute Capture:** Natural language submission with instant AI category and safety checks.
- **Explainable Prioritization:** Transparent rationale for *why* an issue is High, Medium, or Low urgency.
- **Intelligent Deduplication:** Auto-detects duplicates using lexical similarity and proximity scoring; links corroborating reports and awards reduced token incentives to deter spam.
- **Hotspot Clustering:** Aggregates reports by street and radius to surface systemic failure corridors (e.g. *MG Road*).
- **Civic Wallet Rewards:** Citizens earn redeemable Civic Coins (+50 for valid issues, +10 for corroborations, +100 upon municipal resolution).

---

## 🏗️ Architecture & Separation of Concerns

```
civicloop/
├── data/
│   ├── reports.json         # 40 synthetic realistic complaints (hotspot cluster + duplicates)
│   └── wallets.json         # Citizen token ledger and redemption transactions
├── services/
│   └── aiEngine.js          # Pure, modular AI heuristics (Categorization, Duplicate check, Prioritization, Hotspots)
├── public/
│   ├── index.html           # Citizen Portal (Capture form, Civic Wallet, Live Timeline Tracker)
│   └── admin.html           # Authority Command Center (KPIs, Hotspot visualizer, Dispatch workflow)
├── server.js                # Express.js REST API & static file server
├── package.json             # Node.js project manifest
└── README.md                # System documentation & AI architecture notes
```

### Module Responsibilities:
- **`services/aiEngine.js`:** Pure computational service isolated from HTTP concerns. Performs tokenization, Jaccard lexical similarity, Haversine geospatial distance calculations, and rule-based heuristic scoring. Designed as a drop-in adapter interface for future LLM integration (e.g. Google Gemini API).
- **`server.js`:** REST controller layer exposing standard endpoints, enforcing input validation, managing data persistence, and managing citizen token ledger transitions.
- **`public/index.html`:** Mobile-responsive citizen experience featuring live pre-flight feedback, transparent 3-stage resolution timeline, and an interactive Civic Wallet modal.
- **`public/admin.html`:** Operational command center for municipal officials to inspect incoming queues, filter by hotspot zones, and update status workflows.

---

## 🚀 Quickstart & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x, v20.x, or v22+ recommended)
- `npm`

### Installation & Run

1. **Navigate to the project root:**
   ```bash
   cd civicloop
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   *(or `node server.js`)*

4. **Access the Portals in your Browser:**
   - 📱 **Citizen Portal & Civic Wallet:** [http://localhost:3000](http://localhost:3000) (or `/index.html`)
   - 🏛️ **Municipal Authority Dashboard:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🧪 Hackathon Demo Scenarios

Try these pre-configured scenarios directly in the prototype:

### 1. Test Duplicate Detection (Spam Prevention)
- Open the Citizen Portal.
- Click the **"1. Duplicate Road Hazard"** quick preset button (or report a pothole on *MG Road near Metro Pillar 42*).
- Click **Submit**.
- **Result:** The AI engine matches this against existing ticket `REP-1001` (89% similarity). It flags it as a duplicate, awards **+10 Corroboration Coins** (reduced anti-spam reward), and links it to the parent incident.

### 2. Test Critical Safety Prioritization
- Click the **"2. Critical Life Hazard"** preset button (*Fallen pole with live sparking wires near school entrance*).
- Click **Submit**.
- **Result:** The AI flags `sparking`, `live wire`, and `school`, computing an **Urgency Score of 98/100 (High/Critical)** and providing transparent, explainable reasoning in plain language.

### 3. Test Hotspot Clustering
- Open the **Authority Command Center** (`/admin.html`).
- Inspect the **High-Impact Hotspot Clusters** panel.
- Notice **MG Road (Central Ward)** is surfaced as a **Critical Hotspot** with **14 reports** (spanning road collapse, waterlogging, and fallen poles).
- Click **"Filter Queue to MG Road"** to immediately isolate the corridor for municipal contracting.

### 4. Test Civic Wallet & Voucher Redemption
- In the Citizen Portal, view the **Civic Wallet Card** (pre-credited with **150 Civic Coins**).
- Click **"Redeem Cashback / Voucher"**.
- Select **"City Metro Card 50% Top-up"** (Cost: 50 coins).
- Confirm redemption: your balance updates to 100 coins and an authentic voucher coupon is generated!

### 5. Test Resolution Workflow & Bonus Token Credit
- In the **Authority Command Center**, find a ticket (e.g. `REP-1001`) and click **Workflow**.
- Change the status to **"Resolved"**, add a resolution note (e.g., *"Patching completed with cold bituminous mix"*), and click **Save Status & Sync**.
- Return to the Citizen Portal: tracking status updates to **Resolved** and awards a **+100 Civic Coin verified resolution bonus**!

---

## 🔍 Limitations & AI Notes (Transparent Disclosure)

In adherence to clean software engineering and ethical AI hackathon guidelines, the current prototype's components are transparently classified below:

| Component | Current Implementation | Production Evolution Plan |
| :--- | :--- | :--- |
| **NLP Categorization & Summarization** | **Deterministic Lexical Heuristic:** Keyword taxonomy vector matching + extractive sentence synthesis in `services/aiEngine.js`. | Pluggable into **Google Gemini 1.5 Flash / Pro API** via structured JSON schema mode for multilingual comprehension. |
| **Duplicate Detection** | **Jaccard Token Similarity + Haversine Radius Proximity:** Computes a composite match score over normalized tokens and GPS coordinates. | High-dimensional dense vector embeddings via **Text-Embedding-004** + pgvector / Pinecone cosine search. |
| **Prioritization Engine** | **Weighted Hazard Lexicon:** Detects immediate hazards (live wires, sinkholes, blocked hospitals) and outputs explainable rationale strings. | Multimodal vision analysis to verify the photo of the hazard (e.g. assessing water depth or pothole diameter from camera images). |
| **Civic Wallet & Redemptions** | **Local Persistent JSON Ledger (`wallets.json`):** Tracks balances, debits, credits, and simulated voucher codes. | Integration with **UPI / Open Network for Digital Commerce (ONDC)** or smart contract token distribution. |
| **Storage & Persistence** | **Atomic File System (`data/*.json`):** Zero external database configuration required for evaluation. | PostgreSQL with PostGIS extension for spatial queries. |

---

## 🛠️ API Specification

### 1. `GET /api/reports`
- **Query Params:** `category`, `status`, `priority`, `street`, `search`, `isDuplicate`
- **Response:** Array of reports with full AI metadata.

### 2. `POST /api/reports`
- **Body:** `{ title, description, category, location: { street, area, landmark, lat, lng }, imageUrl }`
- **Pipeline:** Runs `autoCategorizeAndSummarize` ➔ `detectDuplicate` ➔ `evaluatePrioritization` ➔ credits wallet tokens.

### 3. `PATCH /api/reports/:id/status`
- **Body:** `{ status, assignedDepartment, resolutionNotes }`
- **Response:** Updated report. Automatically triggers +100 bonus coins if marked `Resolved`.

### 4. `GET /api/insights/hotspots`
- **Response:** Street-level clusters with centroid, active count, and severity indicators.

### 5. `GET /api/insights/stats`
- **Response:** High-level dashboard KPIs (resolution rate, duplicate rate, hazard counts).

### 6. `GET /api/wallet` & `POST /api/wallet/redeem`
- **Response:** Citizen coin balance and transaction ledger.

---

## 👥 Contributors & Hackathon Team
- **CivicLoop Engineering Team**
- Submitted for the *"From Complaints to Action"* Civic Tech Challenge.
- Tech Stack: **Node.js • Express.js • Tailwind CSS • Vanilla JavaScript**
