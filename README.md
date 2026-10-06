# WebCare - Issue Dispatch & Operations Portal

A modern, responsive, real-time client support and issue ticketing system built for **PT Webcare Digital Indonesia**.

## Features

- **Client Portal (`index.html`)**:
  - Issue reporting form with country code selector for WhatsApp (+62, +1, +44, +65, +60, +61, +81, +82, etc.).
  - File/screenshot attachments with drag & drop support and live previews.
  - Form validation requiring all fields except file attachments.
  - Direct ticket generation and storage with instant sync.

- **Admin Operations Dashboard (`admin.html`)**:
  - Real-time queue sync via `localStorage` and `BroadcastChannel`.
  - Date filtering (past 7 days calendar selector with reactive issue counts).
  - Search by ticket ID, client name, website URL, or details.
  - Interactive status management (Pending, On Working, Done).
  - Completed issues automatically moved to History tab with resolved tags.
  - Real-time insights metrics and circular donut chart (Pending: Yellow, On Working: Sky Blue, Done: Dark Blue).
  - One-click WhatsApp & Email resolution notifications with pre-filled professional templates.
  - Voice audio notifications on incoming issues using Web Speech Synthesis & Web Audio API.
  - Lightbox viewer for full-resolution screenshots and error logs.

## Setup & Local Development

Open `index.html` (Client Portal) or `admin.html` (Admin Dashboard) in any modern web browser or serve locally:

```bash
# Using Node.js http-server / serve (optional):
npx serve .
```

## Technologies
- HTML5 / Vanilla CSS3 (Custom 10px rounded design system)
- Vanilla JavaScript (ES6+)
- Web Speech API & Web Audio API
