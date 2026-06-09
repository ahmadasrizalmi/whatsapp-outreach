# WhatsApp Outreach Chrome Extension

Import leads from CSV and send personalized WhatsApp messages with tracking.

## Features

- Import CSV leads from Maps Lead Scraper
- Auto-clean phone numbers (08→62, remove spaces/dashes)
- 3 message templates with variable replacement ({nama}, {bisnis}, {lokasi}, {jenis})
- Preview message before sending
- Open WhatsApp Web with pre-filled message
- Track status: pending, sent, replied
- Compose tab with lead + template selector
- Next pending lead quick navigation
- Mark as sent manually
- Export leads to CSV
- Apple-style UI (light theme, no AI slop)

## Install

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `whatsapp-outreach` folder

## Usage

1. Click extension icon → Side panel opens
2. Go to Leads tab → Click "Import CSV"
3. Select CSV file from Maps Lead Scraper
4. Go to Compose tab → Select lead + template
5. Preview message → Click "Send via WhatsApp"
6. WhatsApp Web opens with pre-filled message
7. Mark as sent or move to next lead

## Template Variables

| Variable | Description |
|----------|-------------|
| `{nama}` | Lead name |
| `{bisnis}` | Business name |
| `{lokasi}` | Address/location |
| `{jenis}` | Business type |

## CSV Format

The extension expects CSV with these columns:
- `name` - Business name
- `phone` - Phone number
- `address` - Address
- `businessType` - Type of business

## Tech

- Chrome Extension Manifest V3
- WhatsApp Web integration (wa.me links)
- CSV parsing
- chrome.storage for persistence
- No external dependencies
