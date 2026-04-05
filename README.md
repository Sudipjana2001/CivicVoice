# CivicVoice

Empowering civic engagement and community voices.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase
- **Maps**: Leaflet / React-Leaflet
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at [http://localhost:8080](http://localhost:8080).

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## Project Structure

```
src/           # Application source code
public/        # Static assets
supabase/      # Supabase configuration and migrations
```

## India Post Assistant

The post assistant is implemented as a Supabase Edge Function named `post-assistant`.

Setup notes:

- Set `OPENAI_API_KEY` as a Supabase Edge Function secret.
- Optionally set `OPENAI_MODEL` if you want to override the default `gpt-5.4-mini`.
- Apply the latest migration before using the feature so the India grounding tables and assistant cache exist.

The assistant uses `fetch` server-side and does not use `axios`.
