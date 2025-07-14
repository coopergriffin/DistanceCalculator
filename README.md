# 🚗 Distance Calculator - Reimbursement Tool

A simple, local web application for calculating driving distances and reimbursement amounts for business travel. Perfect for employees and contractors who need to track travel expenses.

## ✨ Features

- **🔑 API Provider Support**: Works with OpenRouteService (free) and Google Maps (paid)
- **🏠 Home Address Storage**: Save your home address for easy calculations
- **👥 Client Management**: Add up to 25 client locations
- **🧮 Round-Trip Calculations**: Automatically calculates home → client → home routes
- **💰 Reimbursement Calculator**: Set your price per kilometer and get total reimbursement
- **📊 Export Results**: Download detailed CSV reports
- **💾 Local Storage**: All data saved locally in your browser
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### 1. Get Your API Key

#### Option A: OpenRouteService (Recommended - Free)
1. Go to [OpenRouteService](https://openrouteservice.org/)
2. Create a free account
3. Get your API key from the dashboard
4. **Free tier**: 2,000 requests/day

#### Option B: Google Maps (Paid)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Directions API" and "Geocoding API"
4. Create API credentials
5. Set up billing (required)

### 2. Run the Application

1. Download all files to a folder
2. Double-click `index.html` to open in your browser
3. Enter your API key and test the connection
4. Add your home address and client locations
5. Calculate your reimbursement!

## 📖 How to Use

### Step 1: Configure API
1. Select your API provider (OpenRouteService recommended)
2. Enter your API key
3. Click "Test Connection" to verify it works

### Step 2: Set Home Address
1. Enter your home address
2. Click "Save Home Address"

### Step 3: Add Clients
1. Enter client name and address
2. Click "Add Client"
3. Repeat for all clients (up to 25)

### Step 4: Calculate Reimbursement
1. Set your price per kilometer
2. Click "Calculate All Trips"
3. View results and export if needed

## 🔧 Technical Details

### API Providers

#### OpenRouteService (Free)
- **Free tier**: 2,000 requests/day
- **No billing required**
- **Good accuracy** for most use cases
- **Simple setup**

#### Google Maps (Paid)
- **More accurate** routing
- **Requires billing setup**
- **Higher rate limits**
- **Better geocoding**

### Data Storage
- All data is stored locally in your browser
- No data is sent to external servers (except for route calculations)
- Data persists between browser sessions

### Export Format
The CSV export includes:
- Client details and addresses
- Individual trip distances and durations
- Round-trip calculations
- Total reimbursement amount
- Calculation metadata

## 🛠️ File Structure

```
DistanceCalculator/
├── index.html          # Main application
├── styles.css          # Styling
├── app.js             # Main application logic
├── api-providers.js   # API provider system
└── README.md          # This file
```

## 🔄 Switching API Providers

The application is designed to easily switch between API providers:

1. Change the API provider in the dropdown
2. Enter the new API key
3. Test the connection
4. All calculations will use the new provider

## 🎯 Use Cases

- **Employee Reimbursement**: Calculate travel expenses for business trips
- **Contractor Billing**: Track mileage for client visits
- **Expense Reports**: Generate detailed reports for accounting
- **Route Planning**: Plan efficient routes between multiple locations

## 🔒 Privacy & Security

- **Local Storage**: All data stays on your computer
- **No Server**: No data is stored on external servers
- **API Keys**: Your API keys are stored locally and only used for route calculations
- **No Tracking**: No analytics or tracking code

## 🐛 Troubleshooting

### Common Issues

1. **"Connection failed"**
   - Check your API key is correct
   - Verify your API provider is selected
   - Ensure you have internet connection

2. **"No route found"**
   - Check address spelling
   - Try a more specific address
   - Some rural areas may not have routing data

3. **"Geocoding failed"**
   - Try a more detailed address
   - Include city and country
   - Some addresses may need manual coordinates

### Getting Help

- Check your browser's developer console for error messages
- Verify your API key has the correct permissions
- Ensure you haven't exceeded your API quota

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**Happy calculating! 🚗💨** 