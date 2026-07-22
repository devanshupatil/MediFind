<div align="center">

<img src="https://img.shields.io/badge/MediFind-AI%20Medicine%20Search-blue?style=for-the-badge&logo=react" alt="MediFind Banner" />

# 💊 MediFind

### AI-Powered Medicine Search & Inventory Management

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq-Vision%20AI-F55036?style=flat-square)](https://groq.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**MediFind** is a full-stack medicine search and inventory management application.  
Snap a photo of any medicine label — our AI identifies it instantly and pulls live stock & pricing from the database.

[✨ Features](#-features) · [🧠 How AI Works](#-how-the-ai-pipeline-works) · [🛠️ Tech Stack](#️-tech-stack) · [🚀 Getting Started](#-getting-started) · [📁 Project Structure](#-project-structure)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Smart Text Search** | Search medicines by name with instant fuzzy matching |
| 📷 **AI Camera Scanner** | Point camera at a medicine label — Groq Vision reads & identifies it |
| 🖼️ **Photo Upload** | Upload a gallery image for the same AI-powered identification |
| 🏥 **Live Inventory** | Real-time stock status and pricing from a Supabase database |
| 🔐 **Admin Dashboard** | Secure admin panel to add, edit, and manage medicine inventory |
| 📊 **Stats Overview** | Dashboard cards showing total medicines, in-stock count, and more |
| 📱 **Fully Responsive** | Works seamlessly on mobile, tablet, and desktop |
| ⚡ **Blazing Fast** | Groq's LPU inference delivers AI results in milliseconds |

---

## 🧠 How the AI Pipeline Works

The camera scan feature uses a **two-step AI pipeline**:

```
📸 User captures photo
        │
        ▼
┌───────────────────────────────┐
│  Step 1 · Groq Vision OCR     │
│                               │
│  Model: Llama 4 Scout 17B     │
│  - Reads the medicine label   │
│  - Returns structured JSON:   │
│    {                          │
│      name_candidates: [...],  │  ← Brand / Generic names (high priority)
│      all_text: [...]          │  ← All other label text
│    }                          │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Step 2 · Fuzzy Matching      │
│                               │
│  Algorithm: Levenshtein       │
│  - Fetches all medicines from │
│    Supabase database          │
│  - Scores each medicine name  │
│    against AI output (0–100)  │
│  - Returns top 5 ranked       │
│    matches with match score   │
└───────────────────────────────┘
        │
        ▼
✅ User selects the correct medicine
```

### Why Groq instead of a local model?

- **Speed** — Groq's LPU hardware runs Llama 4 Scout in **milliseconds**, far faster than any locally hosted model.
- **No GPU required** — No heavy local setup; works on any device with a browser.
- **Vision capability** — The model understands images, not just text, so it can read labels in various fonts, angles, and lighting conditions.
- **Free tier available** — Groq offers a generous free API tier, making it ideal for student and indie projects.

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3 | UI component library |
| **Vite** | 5.4 | Build tool & dev server |
| **React Router DOM** | 6.26 | Client-side routing (Search, Admin pages) |
| **Framer Motion** | 12.x | Smooth animations & transitions |
| **Tailwind CSS** | 3.4 | Utility-first styling |

### AI & Backend

| Technology | Purpose |
|---|---|
| **Groq API** (`groq-sdk`) | Cloud AI inference — runs the vision model |
| **Meta Llama 4 Scout 17B** | Multimodal LLM that reads medicine label images |
| **Supabase** | PostgreSQL database + auth for medicine inventory |

### Dev Tooling

| Tool | Purpose |
|---|---|
| **Vitest** | Unit & component testing |
| **@testing-library/react** | React component test utilities |
| **PostCSS + Autoprefixer** | CSS processing |

---

## 🗃️ Database Schema

MediFind uses **Supabase (PostgreSQL)** to store medicine data.

```sql
-- medicines table
CREATE TABLE medicines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,        -- Medicine / Brand name
  price          numeric NOT NULL,     -- Price in ₹ (INR)
  quantity       integer NOT NULL,     -- Stock quantity (0 = out of stock)
  company_name   text,                 -- Manufacturer / Company
  composition    text,                 -- Contains / Composition
  mrp_per_strip  numeric,              -- MRP per strip in ₹ (INR)
  expiry_date    date,                 -- Expiry date
  created_at     timestamptz DEFAULT now()
);
```

> Row-Level Security (RLS) is enabled. Public users can **read**; only authenticated admins can **insert / update / delete**.

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- A free [Groq account](https://console.groq.com/) for the API key
- A free [Supabase project](https://supabase.com/) with the medicines table

### 1. Clone the repository

```bash
git clone https://github.com/your-username/MediFind.git
cd MediFind
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.

#### Where to get your keys:
- **Supabase** → [supabase.com](https://supabase.com) → Project Settings → API
- **Groq** → [console.groq.com/keys](https://console.groq.com/keys)

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run tests

```bash
npm test
```

---

## 📁 Project Structure

```
MediFind/
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── CameraSearch.jsx    # 📷 AI camera scanner (Groq Vision + fuzzy match)
│   │   ├── MedicineForm.jsx    # 📝 Add / edit medicine form
│   │   ├── StatsRow.jsx        # 📊 Dashboard stats cards
│   │   ├── BackgroundScene.jsx # 🎨 Animated background
│   │   └── ProtectedRoute.jsx  # 🔐 Auth guard for admin routes
│   ├── pages/
│   │   ├── SearchPage.jsx      # 🔍 Main public search page
│   │   ├── AdminDashboardPage.jsx  # 🏥 Admin inventory management
│   │   └── AdminLoginPage.jsx  # 🔑 Admin login
│   ├── lib/
│   │   ├── supabase.js         # Supabase client setup
│   │   └── strings.js          # UI string constants
│   ├── __tests__/              # Vitest test files
│   ├── App.jsx                 # Root component + routing
│   ├── main.jsx                # React DOM entry point
│   └── index.css               # Global styles
├── .env                     # 🔒 Environment variables (DO NOT COMMIT)
├── .gitignore
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 🔑 Key Component: `CameraSearch.jsx`

This is the heart of the application. It handles the full scan-to-result pipeline:

```jsx
// 1. Capture photo from camera or file upload
const capturePhoto = () => { /* canvas snapshot → base64 */ }

// 2. Send to Groq Vision API
const extracted = await extractTextFromImage(base64, mimeType)
// Returns: { nameCandidates: [...], allText: [...] }

// 3. Score every medicine in Supabase against OCR output
const topMatches = await findMatchingMedicines(extracted)
// Uses Levenshtein distance — scores 0-100

// 4. Display ranked results — user taps to select
```

The matching algorithm gives **higher weight to `name_candidates`** (short, prominent label text) over `all_text` (instructions, batch numbers, etc.) to avoid false positives.

---

## 🔒 Authentication

Admin routes (`/admin`) are protected by **Supabase Auth**:

- Admin logs in with email + password via Supabase's built-in auth
- `ProtectedRoute` component checks session state and redirects unauthenticated users
- Only the admin can add, edit, or delete medicines

---

## 🧪 Testing

Tests are written using **Vitest** + **React Testing Library**:

```bash
npm test          # Run all tests
npm run test:ui   # Open Vitest UI in browser
```

---

## 🌐 Deployment

### Build for production

```bash
npm run build
```

The `dist/` folder can be deployed to:
- **Vercel** (recommended) — connect GitHub repo, auto-detects Vite
- **Netlify** — drag-and-drop `dist/` or connect repo
- **GitHub Pages** — with `vite.config.js` base path set

> Remember to add your environment variables to your hosting platform's dashboard.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ using **React**, **Groq AI**, and **Supabase**

⭐ Star this repo if you found it useful!

</div>
