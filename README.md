# Mena Fixer PWA

Progressive Web App built with Vite, React, TypeScript, and Tailwind CSS.

## Features

- ⚡️ Vite for fast development and building
- ⚛️ React 18 with TypeScript
- 🎨 Tailwind CSS for styling
- 🔐 Authentication with JWT tokens
- 📋 Inspection management system
- 🚛 Truck search and management
- 📸 Image upload for inspection items
- Progressive Web App (PWA) support
- 📱 Service Worker with Workbox
- 🔥 Hot Module Replacement (HMR)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
VITE_API_URL=http://localhost:8000
VITE_IMAGE_API_URL=
```

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

6. Preview production build:
```bash
npm run preview
```

## Project Structure

```
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── Layout.tsx           # Main layout with navigation
│   │   ├── ProtectedRoute.tsx   # Route protection
│   │   └── TruckAutocompleteInput.tsx  # Truck search component
│   ├── contexts/        # React contexts
│   │   └── AuthContext.tsx      # Authentication context
│   ├── pages/           # Page components
│   │   ├── Login.tsx           # Login page
│   │   └── Inspection.tsx      # Inspection management page
│   ├── services/        # API services
│   │   ├── auth.service.ts      # Authentication API
│   │   ├── inspection.service.ts  # Inspection API
│   │   └── image-upload.service.ts # Image upload API
│   ├── App.tsx          # Main App component with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles with Tailwind
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## Pages

### Login Page (`/login`)
- User authentication
- Form validation
- Error handling

### Inspection Page (`/inspection`)
- View inspection history
- Create new inspection
- View inspection details
- Truck search and selection
- Checklist management
- Image upload for failed items
- Mileage tracking

## API Integration

The app integrates with the following APIs:
- Authentication API (`/auth/*`)
- Inspection API (`/mixer-inspection/*`)
- Static Mixer API (`/staticmixer/*`)
- Image Upload API (configured via `VITE_IMAGE_API_URL`)

## PWA Features

This app includes:
- Service Worker for offline support
- Web App Manifest
- Installable on mobile and desktop
- Caching strategies for assets and API calls

## Development

The development server runs on `http://localhost:5173` by default.

## License

MIT

