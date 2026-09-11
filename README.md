# FarmGrid

> **AI-Powered Agricultural Machinery Sharing, Fair Turn Priority Arbitration & Dynamic Field Scheduling**

FarmGrid is a modern, decentralized equipment-sharing and agricultural coordination platform engineered for farming communities, smallholder farmers, and rural custom hiring centers.

During narrow harvesting and planting windows, multiple farmers frequently compete for the same physical tractors, combine harvesters, and implement units. FarmGrid eliminates double-booking, arbitrary lender bias, and crop loss through a transparent, mathematical **Fair Turn Priority Engine**, automated **consecutive time-slot sequencing**, and **live weather risk intelligence**.

---

## Key Features

### 1. Farmer & Equipment Owner Portals
- **Farmer Profile & Land Records**: Register plots with GPS coordinates, acreage, soil crop type, and biological growth stage.
- **Machinery Fleet Onboarding**: List tractors, combine harvesters, seed drills, rotavators, and drone sprayers with hourly/daily pricing, working radius bounds, and attachment types.
- **Strict Data Ownership**: Complete privacy isolation ensuring farmers and equipment lenders only manage their own listings and field plots.

### 2. Fair Turn Priority Arbitration Engine
- **Deterministic 0-100 Priority Scoring**: Replaces human favoritism with an objective scoring model calibrated for agricultural survival:
  - **Urgency & Deadline Proximity** (25 pts max): Time remaining before requested operation window.
  - **Weather Risk Exposure** (25 pts max): Imminent rainfall forecasts and storm alerts.
  - **Crop Vulnerability** (20 pts max): Biological sensitivity to grain shattering, moisture absorption, and lodging.
  - **Anti-Starvation Queue Wait Time** (15 pts max): Protection against repeated deprioritization.
  - **Logistics & Transit Proximity** (10 pts max): Haversine distance and turnaround travel buffer.
  - **Work Criticality** (5 pts max): Emergency harvesting given decisive operational precedence over routine tillage or towing.

### 3. Gemini AI Multilingual Intake & Urgency Evaluator
- **Natural Language & Voice Parsing**: Understands rural vernacular requests in Hindi, Punjabi, Haryanvi, and English.
- **Dynamic Urgency NLP**: Analyzes free-form urgency sentences (e.g., *"Basmati paddy moisture rising, rain forecasted tomorrow"*) to calculate context-aware priority bonuses.
- **Transparent Village Explanations**: Generates respectful, clear arbitration summaries in plain English and Hindi so deprioritized farmers understand why priority was awarded.

### 4. Conflict-Free Sequential Auto-Scheduling
- **No Overlapping Slots**: When multiple requests compete for the same machinery, the highest-ranking farmer receives Turn #1.
- **Consecutive Turn Allocation**: Competing requests are automatically sequenced into consecutive, non-overlapping windows:
  $$\text{startTime}_2 = \text{endTime}_1 + \text{transitBufferMinutes}$$
- **Turnaround Transit Buffers**: Dynamically accounts for travel distance and equipment hitching between different farm locations.

### 5. Live Weather & Field Geolocation
- **Automatic Device Location**: Browser GPS detection with zero manual typing required.
- **OpenWeatherMap Integration**: Live precipitation alerts, rain probability forecasts, and severe storm indicators directly linked to field plots.

### 6. Dual-Persistence Cloud & Offline Architecture
- **Supabase Cloud PostgreSQL**: Real-time multi-device synchronization via Supabase Realtime channels and background polling.
- **Low-Signal Offline Mode**: Local-first fallback saving field requests to offline queues when cellular signal drops, syncing seamlessly once reconnected.

### 7. SMS Dispatch Notifications
- **Twilio SMS Alerts**: Automated SMS dispatch alerts for booking confirmations, equipment arrival ETAs, and emergency weather rescheduling.

### 8. Strict Cancellation Authorization
- **Creator-Only Cancellation**: Only the farmer who created a booking can cancel it. Non-owners are prevented from altering community schedules.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons |
| **Build Tool** | Vite 6 |
| **Cloud Database** | Supabase (PostgreSQL, Realtime WebSockets) |
| **AI / NLP** | Google Gemini API (`@google/genai`) |
| **Weather API** | OpenWeatherMap REST API |
| **Telephony** | Twilio SMS API |
| **Persistence** | Supabase Cloud + Local-First Offline Cache |

---

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher

### 1. Clone the Repository
```bash
git clone https://github.com/farhanbasha/FarmGuard-Pixel-Pirates.git
cd FarmGrid
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# OpenWeather API Key
VITE_OPENWEATHER_API_KEY=your_openweather_api_key

# Google Gemini AI API Key
VITE_GEMINI_API_KEY=your_gemini_api_key

# Supabase PostgreSQL Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twilio SMS Credentials (Optional)
VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid
VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token
VITE_TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Run the Application
```bash
# Start Vite development server
npm run dev
```

Visit `http://localhost:3000` in your web browser.

### 5. Build for Production
```bash
npm run build
npm run preview
```

---

## Project Structure

```
FarmGrid/
├── src/
│   ├── components/
│   │   ├── ArbitrationModal.tsx       # Fair Turn arbitration scorecard & AI explanations
│   │   ├── AuthModal.tsx              # Kisan login & account registration
│   │   ├── DeviceWeatherWidget.tsx    # Live device weather & rain alerts
│   │   ├── DisruptionSimulatorModal.tsx # Breakdown & flood rerouting simulator
│   │   ├── EquipmentCardGrid.tsx      # Community machinery directory
│   │   ├── FarmerActionPanel.tsx      # Field request & urgency justification intake
│   │   ├── Header.tsx                 # Navigation bar & active profile stats
│   │   ├── MasterTimeline.tsx         # Chronological operational field schedule
│   │   ├── OwnerActionPanel.tsx       # Equipment fleet management dashboard
│   │   ├── PlotRegistryModal.tsx      # Field land registration modal
│   │   ├── SentinelBar.tsx            # Connectivity, weather & dispatch status
│   │   └── SupabaseStatusModal.tsx    # Cloud database status & data cleanup
│   ├── lib/
│   │   ├── deviceLocation.ts          # Automatic browser GPS location resolver
│   │   ├── engine.ts                  # Fair Turn priority scoring & sequential scheduling
│   │   ├── gemini.ts                  # Gemini AI multilingual NLP & justification evaluator
│   │   ├── offlineSync.ts             # Local offline queue synchronization
│   │   ├── sms.ts                     # Twilio SMS dispatch integration
│   │   ├── storage.ts                 # Local storage manager with cloud sync
│   │   └── supabase.ts                # Supabase client, queries & realtime listener
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces & domain models
│   ├── App.tsx                        # Main application container
│   ├── index.css                      # Tailwind styling definitions
│   └── main.tsx                       # React application entry point
├── public/                            # Static assets
├── .env                               # Environment configurations
├── index.html                         # HTML entry template
├── package.json                       # Dependencies and build scripts
├── tsconfig.json                      # TypeScript compiler configuration
├── vite.config.ts                     # Vite build configuration
└── README.md                          # Project documentation
```

---

## System Workflow

1. **Farmer Requests Machine**: A farmer specifies field plot, work intent (e.g., harvesting), duration, and an optional urgency justification (e.g., imminent rainstorm).
2. **Conflict Detection**: The system checks lender radius, equipment availability, and existing schedule collisions.
3. **Fair Turn Arbitration**: If competing requests target the same unit, the Fair Turn engine calculates a 0-100 score evaluating rain danger, crop shatter risk, and waiting turn.
4. **Sequential Auto-Scheduling**: The highest-priority booking receives Turn #1. Subsequent bookings are scheduled into consecutive, non-overlapping slots with turnaround transit buffers.
5. **Real-Time Cross-Device Sync**: The updated schedule instantly synchronizes across all users via Supabase Realtime and automatic background polling.
6. **Dispatch Notification**: An automated SMS is sent with dispatch timings and equipment details.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
