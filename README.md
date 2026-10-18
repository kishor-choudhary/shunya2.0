
### *From Shoonya, Everything Begins.*

**Next-Generation Underground Electronic Music & Private Experiences Platform**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r128%2B-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-af00f1?style=for-the-badge)](LICENSE)

[Live Demo](#quick-start) • [Features](#key-features) • [Architecture](#architecture--file-structure) • [Admin Control](#studio-control-room-admin-panel) • [API Reference](#api-endpoints)

---

</div>

## 🌌 Overview

**SHOONYA** is an experiential web platform engineered for an independent underground electronic music collective and bespoke event production house. 

Built with a dark cinematic aesthetic, brutalist neon typography, and fluid multi-stage WebGL scroll mechanics, the platform merges high-performance graphics engineering with a production-grade content management system.

---

## ⚡ Key Features

### 1. 🌀 3D Interactive WebGL Scroll Experience (Home)
- **Multi-Stage Scrollytelling**: Seamless continuous scrub experience across 10 distinct narrative stages.
- **50-Frame Zoom Sequence**: High-definition arched canvas camera zoom keyed to viewport scroll physics.
- **Interactive 3D Stage 5 Mesh**: Three.js curved cylindrical plane gallery with dampening physics, mouse tilt, and touch swipe.
- **Hardware-Capped WebGL Safety**: Capped texture unit allocation and React `ErrorBoundary` fallback to protect lower-end GPUs from context loss.
- **Atmospheric Audio Engine**: Native Web Audio API ambient synthesizer generating spatial drones on demand.

### 2. 🎛️ Events Engine (`/events` & `/events/:slug`)
- **Real-Time Feed**: Powered by dynamic JSON store — nothing appears until confirmed by the studio.
- **Multi-Filter Navigation**: Filter dates by *Upcoming*, *Past Sessions*, and *All Categories* (Warehouse, Open Air, Secret Sessions).
- **Dynamic Event Details**: Dedicated route with lineup breakdown, venue acoustics info, external ticket integration, and interactive FAQ accordions.
- **Live Countdowns**: Real-time ticker counting down to the next gathering.

### 3. 🍸 Private Experiences (`/private-experiences`)
- **Curated Experience Packages**: Private Parties, Birthdays, Pool Parties, Sundowners, Theme Parties, and Exclusive VIP Celebrations.
- **Booking Engine**: Multi-field booking form with client validation, guest count selector, date picker, budget ranges, and honeypot spam protection.
- **One-Click WhatsApp Integration**: Pre-fills custom enquiry payloads for immediate mobile booking.

### 4. 🖼️ Gallery & Media Archive (`/gallery`)
- **Full Masonry Grid**: Responsive multi-column layout displaying high-resolution event photography.
- **Interactive Lightbox**: Full-screen modal with keyboard navigation (`Esc`, `←`, `→`), metadata captions, and locations.
- **Zero-CORS Auto Proxy**: Server automatically downloads remote image URLs locally to eliminate broken third-party links.

### 5. 📬 Tabbed Enquiry Routing (`/contact` & "Let's Talk")
- **Specialized Routing**: Automated dispatch routing for *Private Bookings*, *Artist Collaborations*, *Brand Partnerships*, *Sponsorships*, and *General Enquiries*.
- **Quick Talk Popup**: Global modal accessible from any page navigation pill.

### 6. 🔐 Studio Control Room (`/admin`)
- **Token-Authenticated Gate**: Secure password-protected administrative interface.
- **Complete Event CRUD**: Create, edit, duplicate, publish/unpublish, and reorder events.
- **Live Media Manager**: Direct file uploads or remote URL ingest with live reordering and caption metadata editor.
- **Live Enquiries Inbox**: Centralized dashboard to view and manage client booking requests.
- **Brand Settings**: Instant live editing of WhatsApp contact, Instagram links, and routing emails.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 18 / Next.js Static Export | Client hydration & component lifecycle |
| **3D & Graphics** | Three.js & `@react-three/fiber` | WebGL canvas, custom shaders, and texture pipeline |
| **Styling** | Tailwind CSS & CSS Variables | Dark purple/black cyberpunk aesthetic & responsive grid |
| **Typography** | `Plus Jakarta Sans`, `Instrument Serif`, `JetBrains Mono` | Luxury editorial typography |
| **Backend & Routing**| Pure Node.js (`http`, `https`, `fs`) | Zero-dependency HTTP server with byte-range streaming |
| **Audio** | Web Audio API | Ambient sound synthesis without external audio assets |
| **Storage** | Structured JSON Data Engine (`data/site-data.json`) | Lightweight, portable, database-free persistence |

---

## 📁 Architecture & File Structure

```text
├── index.html                   # Interactive 3D WebGL home experience
├── events.html                  # Events calendar listing page
├── event-detail.html            # Dynamic single event showcase & booking
├── private-experiences.html     # Private bookings showcase & inquiry form
├── about.html                   # Collective story, sound philosophy & archive
├── gallery.html                 # Full responsive photo archive with lightbox
├── contact.html                 # Tabbed email routing & partner inquiries
├── admin.html                   # Studio Control Room (Password-protected CMS)
│
├── server.js                    # Node.js HTTP server & API dispatch router
│
├── data/
│   └── site-data.json           # Central database (events, gallery, settings, enquiries)
│
├── uploads/
│   └── gallery/                 # Local optimized photo archive
│
├── _next/                       # Pre-compiled React, Three.js, and CSS bundles
│   └── static/
│       ├── chunks/03y33...js    # Scrollytelling engine & ErrorBoundary
│       └── chunks/16da4...js    # Three.js WebGL ProjectGallery3D mesh
│
└── public/ / images/            # Static brand assets, icons & culture fallbacks
## Deployment asset compatibility

Keep deployment assets as regular files and directories, not symbolic links.
`uploads/frames/` contains the 50 image-sequence frames, and `uploads/left.jpg`
and `uploads/right.jpg` are regular images. This preserves the existing public
URLs without requiring the deployment packager to resolve symlinks (which can
cause a Vercel `BUILD_FAILED: File ... does not exist` error).

Run the deployment asset regression checks with:

```sh
node --test tests/deployment-assets.test.js
```

After publishing these changes to your connected Git branch, deploy that revision
in Vercel. A redeploy of the old revision will still contain the symlinks.
