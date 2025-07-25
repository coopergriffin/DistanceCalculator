/**
 * Distance Calculator App
 * 
 * Main application logic for calculating driving distances and reimbursement amounts.
 * Handles address input, autocomplete, distance calculations, and data management.
 * 
 * Features:
 * - Address autocomplete with real-time suggestions
 * - Multiple API provider support
 * - Distance calculation with routing
 * - Reimbursement calculation
 * - Data persistence and export
 * 
 * @author Distance Calculator App
 * @version 1.0
 */

// Add this at the top level, before any class or function uses it
function clearInputFeedback(input) {
    if (!input || !input.parentNode) return;
    const types = ['input-error', 'input-warning', 'input-success', 'input-info'];
    types.forEach(type => {
        const el = input.parentNode.querySelector('.' + type);
        if (el) el.remove();
    });
}

/**
 * Main Distance Calculator Class
 * Handles all application functionality including UI, data management, and calculations
 */
class DistanceCalculator {
    constructor() {
        this.homeAddress = '';
        this.trips = []; // Array of trip objects: {stops: [], notReturnHome: false, tripNumber: 1}
        this.currentTripStops = []; // Stops for the current trip being built
        this.notReturnHome = false; // Whether current trip should not return home
        this.pricePerKm = 0.46; // Default CAD per km
        this.apiManager = apiManager; // Use the global API manager
        
        this.loadData();
        this.initializeEventListeners();
        this.updateProviderInfo();
    }

    /**
     * Load saved data from localStorage
     */
    loadData() {
        const savedHome = localStorage.getItem('distanceCalculatorHomeAddress');
        const savedTrips = localStorage.getItem('distanceCalculatorTrips');
        const savedPrice = localStorage.getItem('distanceCalculatorPricePerKm');

        if (savedHome) this.homeAddress = savedHome;
        if (savedTrips) this.trips = JSON.parse(savedTrips);
        if (savedPrice) this.pricePerKm = parseFloat(savedPrice);

        this.updateUI();
    }

    /**
     * Save data to localStorage
     */
    saveData() {
        localStorage.setItem('distanceCalculatorHomeAddress', this.homeAddress);
        localStorage.setItem('distanceCalculatorTrips', JSON.stringify(this.trips));
        localStorage.setItem('distanceCalculatorPricePerKm', this.pricePerKm.toString());
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Home address input with validation button
        const homeInput = document.getElementById('homeAddress');
        const verifyHomeBtn = document.getElementById('verifyHomeAddress');
        const confirmHomeBtn = document.getElementById('confirmHomeAddress');
        
        // Setup verification for home address
        this.setupAddressVerification(homeInput, verifyHomeBtn);
        
        // Confirm home button (separate from verification)
        confirmHomeBtn.addEventListener('click', () => {
            const address = homeInput.value.trim();
            if (!address) {
                this.showError('Please enter a home address first.');
                return;
            }
            
            this.homeAddress = address;
            this.showHomeAddressConfirmed();
            this.saveData();
        });

        // Intermediate stop input with validation
        const intermediateInput = document.getElementById('intermediateAddress');
        const verifyStopBtn = document.getElementById('verifyStopAddress');
        const addStopBtn = document.getElementById('addIntermediateStop');
        
        // Setup verification for stop address
        this.setupAddressVerification(intermediateInput, verifyStopBtn);
        
        // Add stop button (separate from verification)
        addStopBtn.addEventListener('click', () => {
            this.addIntermediateStop();
        });


        // Add client button
        document.getElementById('addClient').addEventListener('click', () => {
            this.addClientAddress();
        });

        // Not return home checkbox
        document.getElementById('notReturnHome')?.addEventListener('change', (e) => {
            this.notReturnHome = e.target.checked;
        });

        // Price per km input - handle decimal input properly
        const priceInput = document.getElementById('pricePerKm');
        priceInput.addEventListener('input', (e) => {
            // Allow user to type freely, do not update UI or save yet
            // Only allow numbers and one decimal point (handled by input type=number)
        });
        priceInput.addEventListener('blur', (e) => {
            let value = e.target.value;
            this.pricePerKm = parseFloat(value) || 0;
            this.saveData();
            this.updateUI();
        });
        priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur(); // Triggers blur event to save
            }
        });

        // Calculate button
        document.getElementById('calculate').addEventListener('click', () => {
            this.calculateDistances();
        });

        // Export button
        document.getElementById('export').addEventListener('click', () => {
            this.exportResults();
        });

        // Clear all button
        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllData();
        });

        // API key management
        const apiKeyInput = document.getElementById('apiKey');
        const clearApiKeyBtn = document.getElementById('clearApiKey');
        const toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibility');
        
        // Load API keys
        this.loadAPIKeys();
        
        // Clear API key
        clearApiKeyBtn.addEventListener('click', () => {
            this.clearAPIKey();
        });
        
        // Toggle API key visibility
        toggleApiKeyVisibilityBtn.addEventListener('click', () => {
            const input = document.getElementById('apiKey');
            if (input.type === 'password') {
                input.type = 'text';
                toggleApiKeyVisibilityBtn.textContent = '🙈';
                toggleApiKeyVisibilityBtn.title = 'Hide API key';
            } else {
                input.type = 'password';
                toggleApiKeyVisibilityBtn.textContent = '👁️';
                toggleApiKeyVisibilityBtn.title = 'Show API key';
            }
        });
        
        // Save API key on input
        apiKeyInput.addEventListener('input', (e) => {
            this.apiManager.setCurrentAPIKey(e.target.value);
            this.updateApiKeyInfo();
        });

        // Debug button
        document.getElementById('debug').addEventListener('click', () => {
            this.debugInfo();
        });

        // Enter key handlers
        homeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });

        intermediateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addIntermediateStop();
            }
        });

        // Select all on first click for all main input bars
        const selectAllOnFirstClick = (input) => {
            let hasSelected = false;
            input.addEventListener('focus', function(e) {
                if (!hasSelected) {
                    input.select();
                    hasSelected = true;
                }
            });
            input.addEventListener('mousedown', function(e) {
                if (!hasSelected) {
                    e.preventDefault();
                    input.focus();
                    input.select();
                    hasSelected = true;
                }
            });
            input.addEventListener('blur', function() {
                hasSelected = false;
            });
        };
        // Apply to all main input bars
        [
            document.getElementById('homeAddress'),
            document.getElementById('intermediateAddress'),
            document.getElementById('pricePerKm'),
            document.getElementById('apiKey')
        ].forEach(input => {
            if (input) selectAllOnFirstClick(input);
        });

        // Load saved API keys
        this.loadAPIKeys();
    }





    /**
     * Setup address verification for an input field
     * @param {HTMLElement} input - Input element for the address
     * @param {HTMLElement} verifyBtn - Button to trigger verification
     */
    setupAddressVerification(input, verifyBtn) {
        let dropdown = null;

        // Create dropdown container for suggestions
        const createDropdown = () => {
            if (dropdown) dropdown.remove();
            dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';
            dropdown.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-radius: 0 0 8px 8px;
            `;
            
            // Ensure parent has relative positioning
            const parent = input.parentNode;
            if (parent.style.position !== 'relative') {
                parent.style.position = 'relative';
            }
            
            parent.appendChild(dropdown);
        };

        // Show dropdown with suggestions
        const showDropdown = (suggestions, label) => {
            clearInputFeedback(input);
            if (!dropdown) createDropdown();
            if (suggestions.length === 0) {
                dropdown.style.display = 'none';
                const errorDiv = input.parentNode.querySelector('.input-error') || document.createElement('div');
                errorDiv.className = 'input-error';
                errorDiv.style.color = '#b94a48';
                errorDiv.style.marginTop = '4px';
                errorDiv.textContent = 'No addresses found. Please try adding more details (city, province, postal code).';
                input.parentNode.appendChild(errorDiv);
                return;
            }
            const prevError = input.parentNode.querySelector('.input-error');
            if (prevError) prevError.remove();
            dropdown.innerHTML = '';
            dropdown.style.display = 'block';
            dropdown.style.zIndex = '9999';
            if (label && label !== 'Exact Match') {
                const labelDiv = document.createElement('div');
                labelDiv.textContent = label;
                labelDiv.style.fontWeight = 'bold';
                labelDiv.style.color = '#856404';
                labelDiv.style.background = '#fff3cd';
                labelDiv.style.padding = '4px 8px';
                labelDiv.style.borderBottom = '1px solid #ffeaa7';
                dropdown.appendChild(labelDiv);
            }
            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = suggestion.address + (suggestion.bestGuess ? ' (Best Guess)' : '');
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                `;
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = '#f0f0f0';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = 'white';
                });
                item.addEventListener('click', () => {
                    input.value = suggestion.address;
                    input.dataset.coordinates = JSON.stringify(suggestion.coordinates);
                    dropdown.style.display = 'none';
                    clearInputFeedback(input);
                });
                dropdown.appendChild(item);
            });
        };

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && (!dropdown || !dropdown.contains(e.target))) {
                if (dropdown) dropdown.style.display = 'none';
            }
        });

        // Show loading state
        const showLoading = (show) => {
            if (show) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verifying...';
            } else {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify';
            }
        };

        // Validate address function
        const validateAddress = async (address) => {
            clearInputFeedback(input);
            showLoading(true);
            let suggestions = [];
            let tried = [];
            let original = address;
            try {
                // 1. Try the original address
                suggestions = await this.apiManager.geocodeAddress(address, 'CA');
                tried.push(address);
                if (suggestions.length > 0) {
                    showDropdown(suggestions, 'Exact Match');
                    this.showInfo('Found suggestions. Click one to select.', input);
                    return { isValid: true, message: 'Found suggestions. Click one to select.' };
                }
                // 1a. Fallback: Try removing street number if present
                const streetNumberMatch = address.match(/^(\d+)\s+(.*)/);
                if (streetNumberMatch) {
                    const noNumber = streetNumberMatch[2];
                    if (!tried.includes(noNumber)) {
                        const noNumberResults = await this.apiManager.geocodeAddress(noNumber, 'CA');
                        if (noNumberResults.length > 0) {
                            suggestions = suggestions.concat(noNumberResults.map(s => ({...s, bestGuess: true})));
                        }
                        tried.push(noNumber);
                    }
                }
                // 2. Try just the postal code (if present)
                const postalMatch = address.match(/[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/);
                if (postalMatch) {
                    const postal = postalMatch[0];
                    if (!tried.includes(postal)) {
                        const postalResults = await this.apiManager.geocodeAddress(postal, 'CA');
                        if (postalResults.length > 0) {
                            suggestions = suggestions.concat(postalResults.map(s => ({...s, bestGuess: true})));
                        }
                        tried.push(postal);
                    }
                }
                // 3. Try removing postal code
                let noPostal = address.replace(/[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/, '').replace(/,\s*$/, '').trim();
                if (noPostal && noPostal !== address && !tried.includes(noPostal)) {
                    const noPostalResults = await this.apiManager.geocodeAddress(noPostal, 'CA');
                    if (noPostalResults.length > 0) {
                        suggestions = suggestions.concat(noPostalResults.map(s => ({...s, bestGuess: true})));
                    }
                    tried.push(noPostal);
                }
                // 4. Try just street + city (drop province/postal)
                const cityMatch = address.match(/,\s*([^,]+),\s*ON/);
                if (cityMatch) {
                    const streetCity = address.split(',')[0] + ',' + cityMatch[1];
                    if (!tried.includes(streetCity)) {
                        const streetCityResults = await this.apiManager.geocodeAddress(streetCity, 'CA');
                        if (streetCityResults.length > 0) {
                            suggestions = suggestions.concat(streetCityResults.map(s => ({...s, bestGuess: true})));
                        }
                        tried.push(streetCity);
                    }
                }
                // 5. Try just city + province
                const cityProvMatch = address.match(/,\s*([^,]+),\s*ON/);
                if (cityProvMatch) {
                    const cityProv = cityProvMatch[1] + ', ON';
                    if (!tried.includes(cityProv)) {
                        const cityProvResults = await this.apiManager.geocodeAddress(cityProv, 'CA');
                        if (cityProvResults.length > 0) {
                            suggestions = suggestions.concat(cityProvResults.map(s => ({...s, bestGuess: true})));
                        }
                        tried.push(cityProv);
                    }
                }
                // 6. Try just the city
                if (cityProvMatch) {
                    const city = cityProvMatch[1];
                    if (!tried.includes(city)) {
                        const cityResults = await this.apiManager.geocodeAddress(city, 'CA');
                        if (cityResults.length > 0) {
                            suggestions = suggestions.concat(cityResults.map(s => ({...s, bestGuess: true})));
                        }
                        tried.push(city);
                    }
                }
                // Remove duplicates by address string
                const seen = new Set();
                suggestions = suggestions.filter(s => {
                    if (seen.has(s.address)) return false;
                    seen.add(s.address);
                    return true;
                });
                if (suggestions.length > 0) {
                    showDropdown(suggestions, 'Best Guess');
                    this.showWarning('No exact matches found, but here are some best guesses. Try alternate formats if needed.', input);
                    this.showInfo('Tried: ' + tried.join(' | '), input);
                    return { isValid: true, message: 'Best guess suggestions shown.' };
                } else {
                    this.showError('No addresses found. Tried: ' + tried.join(' | ') + '. Try alternate formats or check for typos.', input);
                    return { isValid: false, message: 'No addresses found.' };
                }
            } catch (error) {
                // Only show a connection error if it's a real network error (TypeError or fetch failure)
                if (error && (error.name === 'TypeError' || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError'))) {
                    this.showError('Could not connect to the address service. Please check your connection and try again.', input);
                    return { isValid: false, message: 'Connection error.' };
                } else {
                    // If suggestions exist, show them instead of an error
                    if (suggestions && suggestions.length > 0) {
                        showDropdown(suggestions, 'Best Guess');
                        this.showWarning('No exact matches found, but here are some best guesses. Try alternate formats if needed.', input);
                        this.showInfo('Tried: ' + tried.join(' | '), input);
                        return { isValid: true, message: 'Best guess suggestions shown.' };
                    } else {
                        // Otherwise, show a generic not found error
                        this.showError('No addresses found. Tried: ' + tried.join(' | ') + '. Try alternate formats or check for typos.', input);
                        return { isValid: false, message: 'No addresses found.' };
                    }
                }
            } finally {
                showLoading(false);
            }
        };

        // Add event listener for verify button
        verifyBtn.addEventListener('click', async () => {
            const address = input.value.trim();
            if (!address) {
                this.showError('Please enter an address to verify.');
                return;
            }
            await validateAddress(address);
        });
    }

    /**
     * Load API keys from localStorage
     */
    loadAPIKeys() {
        const keys = this.apiManager.getAllAPIKeys();
        const apiKeyInput = document.getElementById('apiKey');
        
        // Set the OpenRouteService API key
        if (keys.openrouteservice) {
            apiKeyInput.value = keys.openrouteservice;
        } else {
            apiKeyInput.value = '';
        }

        // Update placeholder based on current provider
        this.updateAPIKeyPlaceholder();
        this.updateApiKeyInfo();
    }

    /**
     * Update API key placeholder based on current provider
     */
    updateAPIKeyPlaceholder() {
        const apiKeyInput = document.getElementById('apiKey');
        const providerInfo = this.apiManager.getProviderInfo();
        const currentInfo = providerInfo.openrouteservice;
        
        if (currentInfo && currentInfo.requiresKey) {
            apiKeyInput.placeholder = 'Enter your OpenRouteService API key';
            apiKeyInput.disabled = false;
        } else {
            apiKeyInput.placeholder = 'No API key required for this provider';
            apiKeyInput.disabled = true;
        }
    }

    /**
     * Update API key info display
     */
    updateApiKeyInfo() {
        const apiKeyInput = document.getElementById('apiKey');
        const apiKeyInfo = document.querySelector('.api-key-info');
        const userKey = apiKeyInput.value.trim();
        
        if (userKey) {
            apiKeyInfo.innerHTML = `
                <strong>Personal key:</strong> Using your own API key. 
                <a href="https://openrouteservice.org/dev/#/signup" target="_blank">Get a free key</a> if you need one (2,000 requests/day).
            `;
        } else {
            apiKeyInfo.innerHTML = `
                <strong>Demo mode:</strong> Using default API key. 
                <a href="https://openrouteservice.org/dev/#/signup" target="_blank">Get your own free key</a> for unlimited usage (2,000 requests/day).
            `;
        }
    }

    /**
     * Update provider information display
     */
    updateProviderInfo() {
        const providerInfo = this.apiManager.getProviderInfo();
        const currentInfo = providerInfo.openrouteservice;
        
        const infoElement = document.getElementById('providerInfo');
        if (infoElement && currentInfo) {
            infoElement.innerHTML = `
                <strong>${currentInfo.name}</strong><br>
                ${currentInfo.description}<br>
                Free tier: ${currentInfo.freeTier}<br>
                Geocoding: ${currentInfo.geocoding} | Routing: ${currentInfo.routing}
            `;
        }

        // Update API key placeholder
        this.updateAPIKeyPlaceholder();

        // Show rate limit info if available
        const rateLimitDiv = document.getElementById('rateLimitInfo');
        if (rateLimitDiv) {
            const provider = this.apiManager.getCurrentProvider();
            if (provider.getRateLimitInfo) {
                const { limit, remaining } = provider.getRateLimitInfo();
                if (limit && remaining) {
                    rateLimitDiv.innerHTML = `<span style='color:#2980b9'><strong>OpenRouteService requests left today:</strong> ${remaining} / ${limit}</span>`;
                    rateLimitDiv.style.display = '';
                } else {
                    rateLimitDiv.style.display = 'none';
                }
            } else {
                rateLimitDiv.style.display = 'none';
            }
        }
    }

    /**
     * Clear API key
     */
    clearAPIKey() {
        this.apiManager.clearCurrentAPIKey();
        document.getElementById('apiKey').value = '';
        this.updateApiKeyInfo();
    }





    /**
     * End current trip
     */
    async addClientAddress() {
        // Check if we have any stops for the current trip
        if (this.currentTripStops.length === 0) {
            this.showError('Please add at least one stop before ending the trip.');
            return;
        }

        // Create a new trip with the current stops (no client needed)
        const newTrip = {
            tripNumber: this.trips.length + 1,
            stops: [...this.currentTripStops],
            notReturnHome: this.notReturnHome, // Include notReturnHome
            included: true // New trips are included by default
        };
        
        this.trips.push(newTrip);
        this.renumberTrips(); // Renumber trips after adding
        this.currentTripStops = []; // Reset for next trip
        this.notReturnHome = false; // Reset checkbox for next trip
        this.saveData();
        this.updateUI();
        
        this.showSuccess(`Trip ${newTrip.tripNumber} added successfully.`, document.getElementById('addClient'));
    }

    /**
     * Add stop to current trip
     */
    async addIntermediateStop() {
        const input = document.getElementById('intermediateAddress');
        const address = input.value.trim();
        let coordinates = null;
        if (input.dataset.coordinates) {
            try {
                coordinates = JSON.parse(input.dataset.coordinates);
            } catch {}
        }
        // Only show warning if field is empty, and return immediately
        if (!address) {
            clearInputFeedback(input);
            this.showWarning('Please enter a stop address.', input);
            return;
        }
        clearInputFeedback(input); // Always clear before proceeding
        let finalAddress = address;
        let finalCoordinates = coordinates;
        let shouldValidate = !coordinates;
        if (shouldValidate) {
            this.showLoading(true);
            try {
                const validation = await this.apiManager.validateAddress(address);
                if (!validation.isValid) {
                    this.showValidationErrors(validation.errors, validation.warnings, input);
                    return;
                }
                finalAddress = validation.verifiedAddress || address;
                finalCoordinates = validation.coordinates;
                if (validation.warnings.length > 0) {
                    this.showWarning(`Stop added successfully. Note: ${validation.warnings.join(', ')}`, input);
                }
            } catch (error) {
                console.error('Address validation error:', error);
                this.showError('Address validation failed. Please try again.', input);
                return;
            } finally {
                this.showLoading(false);
            }
        }
        // Add the stop as an object
        this.currentTripStops.push({ address: finalAddress, coordinates: finalCoordinates });
        this.saveData();
        this.updateUI();
        input.value = '';
        delete input.dataset.coordinates;
        clearInputFeedback(input); // Clear all feedback after successful add
        // Show checkmark on Add Stop button
        const addStopBtn = document.getElementById('addIntermediateStop');
        if (addStopBtn) {
            const originalText = addStopBtn.textContent;
            addStopBtn.textContent = '✓';
            addStopBtn.disabled = true;
            setTimeout(() => {
                addStopBtn.textContent = originalText;
                addStopBtn.disabled = false;
            }, 1200);
        }
    }

    /**
     * Remove stop from current trip
     * @param {number} index - Index of the stop to remove
     */
    removeIntermediateStop(index) {
        this.currentTripStops.splice(index, 1);
        this.saveData();
        this.updateUI();
    }

    /**
     * Remove trip
     * @param {number} index - Index of the trip to remove
     */
    removeTrip(index) {
        this.trips.splice(index, 1);
        this.renumberTrips(); // Renumber trips after removing
        this.saveData();
        this.updateUI();
    }

    /**
     * Toggle trip inclusion in calculations
     * @param {number} index - Index of the trip to toggle
     */
    toggleTripInclusion(index) {
        if (this.trips[index]) {
            this.trips[index].included = !this.trips[index].included;
            this.saveData();
            this.updateUI();
        }
    }

    /**
     * Build route for a specific trip
     * @param {Object} trip - Trip object with stops and notReturnHome
     * @returns {Array} Array of addresses in route order for this trip
     */
    buildTripRoute(trip) {
        const route = [];
        
        // Start from home
        route.push(this.homeAddress);
        
        // Add stops in order (queue - FIFO)
        if (trip.stops && trip.stops.length > 0) {
            route.push(...trip.stops);
        }
        
        // Return home only if notReturnHome is false
        if (!trip.notReturnHome) {
            route.push(this.homeAddress);
        }
        
        return route;
    }

    /**
     * Build all routes for all trips
     * @returns {Array} Array of all addresses in route order
     */
    buildAllRoutes() {
        const allRoutes = [];
        
        this.trips.forEach(trip => {
            const tripRoute = this.buildTripRoute(trip);
            allRoutes.push(...tripRoute);
        });
        
        return allRoutes;
    }

    /**
     * Show validation errors and warnings
     * @param {Array} errors - Array of error messages
     * @param {Array} warnings - Array of warning messages
     */
    showValidationErrors(errors, warnings) {
        let message = '';
        
        if (errors.length > 0) {
            message += '<strong>Please fix these issues:</strong><br>';
            errors.forEach(error => {
                message += `• ${error}<br>`;
            });
        }
        
        if (warnings.length > 0) {
            message += '<br><strong>Suggestions:</strong><br>';
            warnings.forEach(warning => {
                message += `• ${warning}<br>`;
            });
        }
        
        this.showError(message);
    }

    /**
     * Show warning message
     * @param {string} message - Warning message to display
     */
    showWarning(message, input) {
        let feedbackContainer = null;
        if (input && input.id === 'homeAddress') {
            feedbackContainer = document.getElementById('homeAddressFeedback');
        } else if (input && input.id === 'intermediateAddress') {
            feedbackContainer = document.getElementById('intermediateAddressFeedback');
        }
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
            let warnDiv = document.createElement('div');
            warnDiv.className = 'input-warning';
            warnDiv.textContent = `⚠️ ${message}`;
            feedbackContainer.appendChild(warnDiv);
            setTimeout(() => { if (warnDiv.parentNode) warnDiv.parentNode.removeChild(warnDiv); }, 4000);
        } else {
            const errorDiv = document.getElementById('error');
            errorDiv.innerHTML = `<div style="color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px;"><span style='font-size:1.2em;margin-right:6px;'>⚠️</span> ${message}</div>`;
            errorDiv.style.display = 'block';
            setTimeout(() => { errorDiv.style.display = 'none'; }, 4000);
        }
    }

    /**
     * Remove client address
     * @param {number} index - Index of the address to remove
     */
    removeClientAddress(index) {
        this.currentTripStops.splice(index, 1);
        this.saveData();
        this.updateUI();
    }

    /**
     * Calculate distances for all client addresses
     */
    async calculateDistances() {
        if (!this.homeAddress) {
            this.showError('Please enter your home address first.');
            return;
        }

        // Filter to only include trips that are checked
        const includedTrips = this.trips.filter(trip => trip.included !== false);
        
        if (includedTrips.length === 0) {
            this.showError('Please add at least one trip and ensure it is included in calculations (checkbox checked).');
            return;
        }

        // Skip home address validation for calculation - we'll validate during geocoding instead
        // This prevents issues with autocomplete addresses that might fail strict validation

        // Check if API key is required for current provider
        const providerInfo = this.apiManager.getProviderInfo();
        const currentProvider = this.apiManager.getCurrentProvider();
        const currentInfo = providerInfo.openrouteservice; // We only use OpenRouteService
        const apiKey = this.apiManager.getCurrentAPIKey();
        
        if (currentInfo && currentInfo.requiresKey && !apiKey) {
            this.showError('Please enter your API key first.');
            return;
        }

        this.showLoading(true);
        this.clearResults();

        try {
            // Test API connection first
            await this.testAPIConnection();

            const results = [];
            let totalDistance = 0;
            let totalReimbursement = 0;

            // Calculate each trip separately (only included trips)
            for (let tripIndex = 0; tripIndex < this.trips.length; tripIndex++) {
                const trip = this.trips[tripIndex];
                
                // Skip trips that are not included
                if (trip.included === false) {
                    continue;
                }
                
                const tripRoute = this.buildTripRoute(trip);
                
                // Calculate distances for this trip
                for (let i = 0; i < tripRoute.length - 1; i++) {
                    const fromAddress = tripRoute[i];
                    const toAddress = tripRoute[i + 1];
                    
                    // Leg description for error reporting
                    let legDescription = '';
                    if (i === 0) {
                        legDescription = 'Home → First Stop';
                    } else if (i === tripRoute.length - 2) {
                        legDescription = 'Last Stop → Home';
                    } else {
                        legDescription = `Stop ${i} → Stop ${i + 1}`;
                    }
                    try {
                        const result = await this.calculateSingleDistance(fromAddress, toAddress, trip.tripNumber, legDescription);
                        results.push({
                            tripNumber: trip.tripNumber,
                            from: fromAddress,
                            to: toAddress,
                            distance: result.distance,
                            duration: result.duration,
                            reimbursement: result.distance * this.pricePerKm,
                            ...(result.fallback ? { fallback: true } : {})
                        });
                        
                        totalDistance += result.distance;
                        totalReimbursement += result.distance * this.pricePerKm;
                        
                    } catch (error) {
                        results.push({
                            tripNumber: trip.tripNumber,
                            from: fromAddress,
                            to: toAddress,
                            distance: 0,
                            duration: 0,
                            reimbursement: 0,
                            error: `Trip ${trip.tripNumber}, ${legDescription}: ${error.message}`
                        });
                    }
                }
                
                // Update progress
                this.updateProgress(tripIndex + 1, this.trips.length);
            }

            this.displayResults(results, totalDistance, totalReimbursement);
            
        } catch (error) {
            console.error('Calculation error:', error);
            this.showError(`Calculation failed: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Test API connection
     */
    async testAPIConnection() {
        try {
            // Test with a simple geocoding request
            const testResults = await this.apiManager.geocodeAddress('Toronto, ON', 'CA');
            if (testResults.length === 0) {
                throw new Error('API connection test failed - no results returned');
            }
            console.log('API connection test successful');
        } catch (error) {
            throw new Error(`API connection failed: ${error.message}`);
        }
    }

    /**
     * Build the complete route including intermediate stops and return home option
     * @returns {Array} Array of addresses in route order
     */
    buildRoute() {
        const route = [];
        
        if (this.useIntermediateStops && this.currentTripStops.length > 0) {
            // Route with intermediate stops: Home → Client → Stop → Client → Stop → Client → Home
            route.push(this.homeAddress);
            
            // Interleave clients and intermediate stops
            for (let i = 0; i < this.currentTripStops.length; i++) {
                route.push(this.currentTripStops[i]);
                
                // Add intermediate stop after each client (except the last one)
                if (i < this.currentTripStops.length - 1) {
                    route.push(this.currentTripStops[i]);
                }
            }
            
            if (this.homeAddress) {
                route.push(this.homeAddress);
            }
        } else {
            // Individual round trips: Home → Client → Home for each client
            this.currentTripStops.forEach(clientAddress => {
                route.push(this.homeAddress);
                route.push(clientAddress);
                if (this.homeAddress) {
                    route.push(this.homeAddress);
                }
            });
        }
        
        return route;
    }

    /**
     * Calculate distance between two addresses
     * @param {string} origin - Origin address
     * @param {string} destination - Destination address
     * @param {number} tripNumber - Trip number for error reporting
     * @param {string} legDescription - Leg description for error reporting
     * @returns {Object} Distance and duration information
     */
    async calculateSingleDistance(origin, destination, tripNumber = null, legDescription = null) {
        try {
            let originCoords = null, destCoords = null;
            let originAddress = typeof origin === 'object' && origin.address ? origin.address : origin;
            let destAddress = typeof destination === 'object' && destination.address ? destination.address : destination;
            if (typeof origin === 'object' && origin.coordinates) {
                originCoords = origin.coordinates;
            }
            if (typeof destination === 'object' && destination.coordinates) {
                destCoords = destination.coordinates;
            }
            if (!originCoords) {
                const originResults = await this.apiManager.geocodeAddress(originAddress, 'CA');
                if (originResults.length === 0) {
                    throw new Error(`Could not find coordinates for origin: ${originAddress}`);
                }
                originCoords = originResults[0].coordinates;
            }
            if (!destCoords) {
                const destResults = await this.apiManager.geocodeAddress(destAddress, 'CA');
                if (destResults.length === 0) {
                    throw new Error(`Could not find coordinates for destination: ${destAddress}`);
                }
                destCoords = destResults[0].coordinates;
            }
            // Pass address info for error logging
            const routeResult = await this.apiManager.calculateDistance(originCoords, destCoords, {
                tripNumber,
                legDescription,
                originAddress,
                destAddress
            });
            return {
                distance: routeResult.distance,
                duration: routeResult.duration,
                route: routeResult.route,
                ...(routeResult.fallback ? { fallback: true } : {})
            };
        } catch (error) {
            // Add trip/leg/address info to error log
            let extra = '';
            if (tripNumber !== null && legDescription) {
                extra = `[Trip ${tripNumber}, Leg: ${legDescription}]`;
            }
            console.error(`${extra} Distance calculation error:`, error);
            throw error;
        }
    }

    /**
     * Display calculation results
     * @param {Array} results - Array of calculation results
     * @param {number} totalDistance - Total distance in km
     * @param {number} totalReimbursement - Total reimbursement amount
     */
    displayResults(results, totalDistance, totalReimbursement) {
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = '';

        // Group results by trip
        const tripGroups = {};
        results.forEach(result => {
            if (!tripGroups[result.tripNumber]) {
                tripGroups[result.tripNumber] = [];
            }
            tripGroups[result.tripNumber].push(result);
        });

        // Create results table
        const table = document.createElement('table');
        table.className = 'results-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Trip</th>
                    <th>Leg</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Distance (km)</th>
                    <th>Duration (min)</th>
                    <th>Reimbursement (CAD)</th>
                    <th>No Return Home</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${Object.keys(tripGroups).map(tripNumber => {
                    const tripResults = tripGroups[tripNumber];
                    const trip = this.trips.find(t => t.tripNumber === parseInt(tripNumber));
                    const notReturnHome = trip ? trip.notReturnHome : false;
                    
                    // Calculate trip totals
                    const tripTotalDistance = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.distance), 0);
                    const tripTotalDuration = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.duration), 0);
                    const tripTotalReimbursement = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.reimbursement), 0);
                    
                    return tripResults.map((result, index) => {
                        const distance = result.error ? 'Error' : result.distance.toFixed(1);
                        const duration = result.error ? 'Error' : this.formatDuration(result.duration);
                        const reimbursement = result.error ? 'Error' : '$' + (result.distance * this.pricePerKm).toFixed(2);
                        const isEditable = !result.error;
                        
                        // Determine leg description
                        let legDescription = '';
                        if (index === 0) {
                            legDescription = 'Home → First Stop';
                        } else if (index === tripResults.length - 1) {
                            legDescription = 'Last Stop → Home';
                        } else {
                            legDescription = `Stop ${index} → Stop ${index + 1}`;
                        }
                        // Add fallback warning if straight-line distance was used
                        let fallbackWarning = '';
                        let fallbackClass = '';
                        if (result.fallback) {
                            fallbackWarning = `<span title="No route found, straight-line distance used. Result may be less accurate." style="color:#e67e22;cursor:help;font-size:1.2em;vertical-align:middle;">⚠️</span> <span style='font-size:0.9em;font-weight:bold;margin-left:2px;'>Fallback</span>`;
                            fallbackClass = 'fallback-distance';
                        }
                        return `
                            <tr class="${result.error ? 'error-row' : ''} ${result.fallback ? 'fallback-row' : ''} ${index === 0 ? 'trip-start' : ''}" data-index="${results.indexOf(result)}" data-trip="${result.tripNumber}">
                                <td>${index === 0 ? `<strong>Trip ${result.tripNumber}</strong>` : ''}</td>
                                <td>${legDescription}</td>
                                <td>${typeof result.from === 'object' && result.from.address ? result.from.address : result.from}</td>
                                <td>${typeof result.to === 'object' && result.to.address ? result.to.address : result.to}</td>
                                <td class="${fallbackClass}">
                                    ${isEditable ? `<input type="number" class="distance-input" value="${result.distance.toFixed(1)}" step="0.1" min="0" data-index="${results.indexOf(result)}">` : distance}
                                    ${result.fallback ? `<span class="fallback-warning" title="No driving route found. This is a straight-line distance. Try a more specific address, or enter the distance manually." style="color:#e67e22;cursor:help;font-size:1.1em;vertical-align:middle;margin-left:6px;">
                                        ⚠️ Fallback: Straight-line distance used.<br><span style='font-size:0.95em;font-weight:normal;'>Try a more specific address, or enter the distance manually.</span>
                                    </span>` : ''}
                                </td>
                                <td><span class="leg-duration">${duration}</span></td>
                                <td class="reimbursement-cell">${reimbursement}</td>
                                <td>
                                    ${index === 0 ? `
                                        <label class="checkbox-label">
                                            <input type="checkbox" class="return-home-checkbox" ${notReturnHome ? 'checked' : ''} data-trip="${result.tripNumber}">
                                            <span class="checkmark"></span>
                                        </label>
                                    ` : ''}
                                </td>
                                <td>
                                    ${isEditable ? 
                                        `<span class="editable-indicator">✓ Editable</span>` : 
                                        `<button class="manual-btn" onclick="calculator.addManualDistance(${results.indexOf(result)})">Add Manual Distance</button>`
                                    }
                                </td>
                            </tr>
                            ${result.error ? `<tr><td colspan="9" class="error-message">${result.error}</td></tr>` : ''}
                        `;
                    }).join('') + `
                        <tr class="trip-total">
                            <td><strong>Trip ${tripNumber} Total</strong></td>
                            <td colspan="2"><strong>Complete Trip</strong></td>
                            <td></td>
                            <td><strong>${tripTotalDistance.toFixed(1)} km</strong></td>
                            <td><strong><span class="trip-total-duration">${this.formatDuration(tripTotalDuration)}</span></strong></td>
                            <td><strong>$${tripTotalReimbursement.toFixed(2)}</strong></td>
                            <td></td>
                            <td></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;

        resultsContainer.appendChild(table);

        // Add summary
        const summary = document.createElement('div');
        summary.className = 'results-summary';
        summary.innerHTML = `
            <h3>Summary</h3>
            <p><strong>Total Trips:</strong> ${this.trips.length}</p>
            <p><strong>Total Route Distance:</strong> <span id="totalDistance">${totalDistance.toFixed(1)}</span> km</p>
            <p><strong>Total Reimbursement:</strong> <span id="totalReimbursement">$${totalReimbursement.toFixed(2)}</span> CAD</p>
            <p><strong>Price per km:</strong> $${this.pricePerKm.toFixed(2)} CAD</p>
            <p><strong>Return Home:</strong> Yes</p>
            <h4>Trip Details:</h4>
            ${this.trips.map(trip => `
                <p><strong>Trip ${trip.tripNumber}:</strong> Home → ${trip.stops.length > 0 ? trip.stops.map(stop => typeof stop === 'object' && stop.address ? stop.address : stop).join(' → ') + ' → ' : ''}${trip.notReturnHome ? 'End' : 'Home'}</p>
            `).join('')}
        `;

        resultsContainer.appendChild(summary);

        // Add editing instructions
        const editingInfo = document.createElement('div');
        editingInfo.className = 'editing-info';
        editingInfo.innerHTML = `
            <p><strong>💡 Tip:</strong> You can edit individual distances by directly typing in the distance fields. 
            Changes will automatically recalculate totals and reimbursements.</p>
            <p><strong>📊 Duration Display:</strong> Individual leg durations are shown in regular text, while trip total durations (sum of all legs) are shown in <strong style="color: #e74c3c;">red bold text</strong>.</p>
        `;
        resultsContainer.appendChild(editingInfo);

        // Store results for editing
        this.currentResults = results;
        this.currentTotalDistance = totalDistance;
        this.currentTotalReimbursement = totalReimbursement;

        // Add event listeners for distance inputs
        this.setupDistanceInputListeners();
        
        // Add event listeners for return home checkboxes
        this.setupReturnHomeCheckboxListeners();
    }

    /**
     * Update progress indicator
     * @param {number} current - Current progress
     * @param {number} total - Total items
     */
    updateProgress(current, total) {
        const progressElement = document.getElementById('progress');
        if (progressElement) {
            const percentage = (current / total) * 100;
            progressElement.style.width = percentage + '%';
            progressElement.textContent = `${current}/${total}`;
        }
    }

    /**
     * Show/hide loading state
     * @param {boolean} show - Whether to show loading state
     */
    showLoading(show) {
        const calculateBtn = document.getElementById('calculate');
        const progressContainer = document.getElementById('progressContainer');
        
        if (show) {
            calculateBtn.disabled = true;
            calculateBtn.textContent = 'Calculating...';
            progressContainer.style.display = 'block';
        } else {
            calculateBtn.disabled = false;
            calculateBtn.textContent = 'Calculate Distances';
            progressContainer.style.display = 'none';
        }
    }

    /**
     * Clear results
     */
    clearResults() {
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = '';
    }

    /**
     * Export results to Excel (XLSX) in full expense report template with enhanced formatting
     */
    exportResults() {
        const resultsContainer = document.getElementById('results');
        const table = resultsContainer.querySelector('table');
        if (!table) {
            this.showError('No results to export. Please calculate distances first.');
            return;
        }

        // --- 1. Build the worksheet data (AOA) ---
        const aoa = [];
        // Title row (merged, bold, yellow)
        aoa.push(['Toronto Blue Jays - Amateur Baseball Expenses 2025']);
        // Name, Address, Period rows (all blank for user entry)
        aoa.push(['Name:', '', '', '', '', '', '']);
        aoa.push(['Address:', '', '', '', '', '', '']);
        aoa.push(['Period From:', '', '', '', 'Period To:', '', '']);
        // Header row for main table
        aoa.push(['Date', 'City', 'Province', 'Description', 'KM', 'Hotels', '']);

        // --- 2. Add trip legs as rows ---
        let totalKM = 0;
        let mainTableStart = aoa.length;
        if (this.currentResults) {
            // Helper to shorten address for user-friendly display
            function shortenAddress(addr) {
                if (!addr) return '';
                // If it's an object with .address, use that
                if (typeof addr === 'object' && addr.address) addr = addr.address;
                // Try to extract landmark/business/park name (before first comma, if not a street address)
                const landmarkMatch = addr.match(/^([^,\d]+),\s*([^,]+),\s*([A-Z]{2})/);
                if (landmarkMatch) {
                    // e.g., 'Stan Wadlow Field, East York, ON' => 'Stan Wadlow Field, East York'
                    return landmarkMatch[1].trim() + ', ' + landmarkMatch[2].trim();
                }
                // Try to extract street number and name + city
                const streetCityMatch = addr.match(/^(\d+\s+[A-Za-z0-9 .'-]+),\s*([^,]+),\s*([A-Z]{2})/);
                if (streetCityMatch) {
                    // e.g., '50 Wellesley Street, Toronto, ON' => '50 Wellesley Street, Toronto'
                    return streetCityMatch[1].trim() + ', ' + streetCityMatch[2].trim();
                }
                // Try to extract just city, province
                const cityProvMatch = addr.match(/,\s*([^,]+),\s*([A-Z]{2})/);
                if (cityProvMatch) {
                    return cityProvMatch[1].trim() + ', ' + cityProvMatch[2].trim();
                }
                // If it's a postal code
                const postalMatch = addr.match(/[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/);
                if (postalMatch) {
                    // e.g., 'M5V 3A8, Toronto, ON' => 'M5V 3A8, Toronto'
                    const cityMatch = addr.match(/,\s*([^,]+),/);
                    return postalMatch[0] + (cityMatch ? ', ' + cityMatch[1].trim() : '');
                }
                // Fallback: use first part before comma
                return addr.split(',')[0];
            }
            // Helper to compare addresses (ignoring case and whitespace)
            function isHomeAddress(addr, homeAddr) {
                if (!addr || !homeAddr) return false;
                if (typeof addr === 'object' && addr.address) addr = addr.address;
                return addr.replace(/\s+/g, '').toLowerCase() === homeAddr.replace(/\s+/g, '').toLowerCase();
            }
            const homeShort = 'Home';
            this.currentResults.forEach(result => {
                // Parse city/province from 'to' address
                let city = '', province = '';
                let toAddr = typeof result.to === 'object' && result.to.address ? result.to.address : result.to;
                const cityMatch = toAddr.match(/,\s*([^,]+),\s*([A-Z]{2})/);
                if (cityMatch) {
                    city = cityMatch[1].trim();
                    province = cityMatch[2].trim();
                } else {
                    const provMatch = toAddr.match(/,\s*([A-Z]{2})/);
                    if (provMatch) province = provMatch[1].trim();
                }
                // Description: always 'from to to', but with 'Home' for home address
                let fromLabel = isHomeAddress(result.from, this.homeAddress) ? homeShort : shortenAddress(result.from);
                let toLabel = isHomeAddress(result.to, this.homeAddress) ? homeShort : shortenAddress(result.to);
                let desc = '';
                if (result.error) {
                    desc = `Could not calculate: ${result.error}`;
                } else {
                    desc = `${fromLabel} to ${toLabel}`;
                }
                // Add row: Date, City, Province, Description, KM, Hotels, ''
                aoa.push(['', city, province, desc, result.error ? '' : (result.distance ? result.distance.toFixed(1) : ''), '', '']);
                if (!result.error) totalKM += result.distance || 0;
            });
        }
        let mainTableEnd = aoa.length - 1;
        // --- 3. Totals row ---
        aoa.push(['', '', '', 'TOTAL', totalKM ? totalKM.toFixed(1) : '', '$0.00', '']);
        // --- 4. Cost per KM row ---
        aoa.push(['', '', '', '', `${this.pricePerKm ? this.pricePerKm.toFixed(2) : ''}/km`, '', '']);
        // --- 5. Blank row ---
        aoa.push(['']);
        // --- 6. Miscellaneous/Extra Sections (as in screenshot) ---
        // Section: Miscellaneous
        const miscHeaderRow = aoa.length;
        aoa.push(['Miscellaneous']);
        aoa.push(['Date:', 'Taxi / Limos', 'Amount', 'Mileage', '752-1101-5301-7921-65010-000-000', '', '']);
        aoa.push(['Date:', 'Parking / Tolls / Gas', 'Amount', 'Taxi/Limos', '752-1101-5301-7921-65010-000-000', '', '']);
        aoa.push(['', 'Parking/Tolls', '752-1101-5301-7921-65010-000-000', '', '', '', '']);
        aoa.push(['', 'Airfare/Cars', '752-1101-5301-7921-69050-000-000', '', '', '', '']);
        aoa.push(['', 'Telephone', '752-1101-5301-7921-69050-000-000', '', '', '', '']);
        aoa.push(['', 'Supplies', '752-1101-5301-7921-69140-000-000', '', '', '', '']);
        aoa.push(['', 'Postage', '752-1101-5301-7921-67521-000-000', '', '', '', '']);
        aoa.push(['', 'Misc.', '752-1101-5301-7921-73170-000-000', '', '', '', '']);
        aoa.push(['', 'Total GST', '752-1101-0000-0000-04300-000-000', '', '', '', '']);
        aoa.push(['Date:', 'Airfare / Car Rentals', 'Amount', 'Supplies', '752-1101-5301-7921-69140-000-000', '', '']);
        aoa.push(['Date:', 'Telephone / Fax', 'Amount', 'Deductions', '', '', '']);
        const fundsHeaderRow = aoa.length;
        aoa.push(['CDN FUNDS TO REIMBURSE:']);
        aoa.push(['Date:', 'Office Supplies / Copies', 'Amount', 'Submitted By:', '', '', '']);
        aoa.push(['Date:', 'Miscellaneous', 'Amount', 'Approved By:', '', '', '']);
        aoa.push(['', 'Postage', '', 'Approval Date:', '', '', '']);
        aoa.push(['', '', '', 'Shipping Instructions', '', '', '']);
        aoa.push(['TOTAL', '$0.00', 'Employee #', '####', '', '', '']);

        // --- 7. Build worksheet and apply formatting ---
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Merge cells for title and section headers (dynamically)
        ws['!merges'] = [
            { s: { r:0, c:0 }, e: { r:0, c:6 } }, // Title
            { s: { r:miscHeaderRow, c:0 }, e: { r:miscHeaderRow, c:6 } }, // Miscellaneous
            { s: { r:fundsHeaderRow, c:0 }, e: { r:fundsHeaderRow, c:6 } }, // CDN FUNDS TO REIMBURSE
        ];
        // Set column widths for readability
        ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 18 }, // City
            { wch: 12 }, // Province
            { wch: 38 }, // Description
            { wch: 10 }, // KM
            { wch: 10 }, // Hotels
            { wch: 10 }, // Extra
        ];
        // --- 8. Apply styles ---
        const yellow = { fgColor: { rgb: 'FFFF00' } };
        const center = { horizontal: 'center', vertical: 'center' };
        const bold = { bold: true };
        const font = { name: 'Calibri', sz: 12 };
        const thickBorder = { style: 'thick', color: { rgb: '000000' } };
        const thinBorder = { style: 'thin', color: { rgb: '000000' } };
        // Helper to set style
        function setStyle(cell, opts) {
            if (ws[cell]) ws[cell].s = Object.assign({}, ws[cell].s||{}, opts);
        }
        // Title row
        setStyle('A1', { font: { ...font, ...bold, sz: 16 }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } });
        // Name/Address/Period rows
        ['A2','A3','A4','E4'].forEach(cell => setStyle(cell, { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } }));
        // Main table header
        ['A5','B5','C5','D5','E5','F5'].forEach(cell => setStyle(cell, { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } }));
        // Main table body
        for(let r=mainTableStart+1;r<=mainTableEnd;r++){
            for(let c=0;c<=6;c++){
                const cell = XLSX.utils.encode_cell({r,c});
                // Hotels column and blank cells: yellow fill
                if (c === 5 || (ws[cell] && ws[cell].v === '')) {
                    setStyle(cell, { fill: yellow, alignment: center, font });
                } else {
                    setStyle(cell, { alignment: center, font });
                }
                // Borders
                setStyle(cell, { border: { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder } });
            }
        }
        // Totals row
        const totalRow = mainTableEnd+1;
        for(let c=0;c<=6;c++){
            const cell = XLSX.utils.encode_cell({ r: totalRow, c });
            setStyle(cell, { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } });
        }
        // Cost per KM row
        const costRow = totalRow+1;
        for(let c=0;c<=6;c++){
            const cell = XLSX.utils.encode_cell({ r: costRow, c });
            setStyle(cell, { font, alignment: center, border: { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder } });
        }
        // Section headers (Miscellaneous, CDN FUNDS TO REIMBURSE)
        setStyle('A14', { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } });
        setStyle('A24', { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } });
        // Label cells in extra sections
        ['A15','A16','A17','A18','A19','A20','A21','A22','A23','A25','A26','A28','A29','A31'].forEach(cell => setStyle(cell, { font: { ...font, ...bold }, fill: yellow, alignment: center, border: { top: thickBorder, left: thickBorder, right: thickBorder, bottom: thickBorder } }));
        // All other cells in extra sections: center, font, thin border
        for(let r=14;r<=31;r++){
            for(let c=0;c<=6;c++){
                const cell = XLSX.utils.encode_cell({r,c});
                setStyle(cell, { alignment: center, font, border: { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder } });
            }
        }
        // --- 9. Export ---
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expense Report');
        const filename = `distance_expense_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            this.homeAddress = '';
            this.trips = [];
            this.currentTripStops = []; // Clear intermediate stops
            this.pricePerKm = 0.46;
            this.saveData();
            this.updateUI();
            this.clearResults();
        }
    }

    /**
     * Show home address confirmed message
     */
    showHomeAddressConfirmed() {
        const confirmBtn = document.getElementById('confirmHomeAddress');
        const originalText = confirmBtn.textContent;
        
        // Visual feedback
        confirmBtn.textContent = '✓ Confirmed';
        confirmBtn.style.backgroundColor = '#28a745';
        confirmBtn.style.color = 'white';
        
        // Show success message
        this.showWarning('Home address confirmed and saved!');
        
        // Reset button after 3 seconds
        setTimeout(() => {
            confirmBtn.textContent = originalText;
            confirmBtn.style.backgroundColor = '';
            confirmBtn.style.color = '';
        }, 3000);
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message, input) {
        let feedbackContainer = null;
        if (input && input.id === 'homeAddress') {
            feedbackContainer = document.getElementById('homeAddressFeedback');
        } else if (input && input.id === 'intermediateAddress') {
            feedbackContainer = document.getElementById('intermediateAddressFeedback');
        }
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
            let errorDiv = document.createElement('div');
            errorDiv.className = 'input-error';
            errorDiv.textContent = `❗ ${message}`;
            feedbackContainer.appendChild(errorDiv);
        } else {
            const errorDiv = document.getElementById('error');
            errorDiv.innerHTML = `<div style="color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px;"><span style='font-size:1.2em;margin-right:6px;'>⚠️</span> ${message}</div>`;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message to display
     */
    showSuccess(message, input) {
        let feedbackContainer = null;
        if (input && input.id === 'homeAddress') {
            feedbackContainer = document.getElementById('homeAddressFeedback');
        } else if (input && input.id === 'intermediateAddress') {
            feedbackContainer = document.getElementById('intermediateAddressFeedback');
        }
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
            let successDiv = document.createElement('div');
            successDiv.className = 'input-success';
            successDiv.textContent = `✅ ${message}`;
            feedbackContainer.appendChild(successDiv);
            setTimeout(() => { if (successDiv.parentNode) successDiv.parentNode.removeChild(successDiv); }, 4000);
        } else {
            const successDiv = document.getElementById('success');
            successDiv.innerHTML = `<div style="color: #28a745; background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px;"><span style='font-size:1.2em;margin-right:6px;'>✅</span> ${message}</div>`;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 4000);
        }
    }

    /**
     * Show info message
     * @param {string} message - Info message to display
     */
    showInfo(message, input) {
        let feedbackContainer = null;
        if (input && input.id === 'homeAddress') {
            feedbackContainer = document.getElementById('homeAddressFeedback');
        } else if (input && input.id === 'intermediateAddress') {
            feedbackContainer = document.getElementById('intermediateAddressFeedback');
        }
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
            let infoDiv = document.createElement('div');
            infoDiv.className = 'input-info';
            infoDiv.textContent = `ℹ️ ${message}`;
            feedbackContainer.appendChild(infoDiv);
            setTimeout(() => { if (infoDiv.parentNode) infoDiv.parentNode.removeChild(infoDiv); }, 3000);
        } else {
            const infoDiv = document.getElementById('info');
            infoDiv.innerHTML = `<div style="color: #0c5460; background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 4px;"><span style='font-size:1.2em;margin-right:6px;'>ℹ️</span> ${message}</div>`;
            infoDiv.style.display = 'block';
            setTimeout(() => {
                infoDiv.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Debug information
     */
    debugInfo() {
        const debugInfo = {
            homeAddress: this.homeAddress,
            trips: this.trips,
            pricePerKm: this.pricePerKm,
            currentProvider: this.currentProvider,
            apiKey: this.apiManager.getCurrentAPIKey() ? 'Set' : 'Not set',
            localStorage: {
                home: localStorage.getItem('distanceCalculatorHomeAddress'),
                trips: localStorage.getItem('distanceCalculatorTrips'),
                price: localStorage.getItem('distanceCalculatorPricePerKm'),
                provider: localStorage.getItem('distanceCalculatorProvider'),
                apiKeys: localStorage.getItem('distanceCalculatorAPIKeys')
            }
        };

        console.log('Debug Information:', debugInfo);
        alert('Debug information logged to console. Press F12 to view.');
    }

    /**
     * Update UI with current data
     */
    updateUI() {
        document.getElementById('homeAddress').value = this.homeAddress;
        document.getElementById('pricePerKm').value = this.pricePerKm.toFixed(2);
        document.getElementById('intermediateAddress').value = '';

        // Update provider selection
        const providerSelect = document.getElementById('providerSelect');
        if (providerSelect) {
            providerSelect.value = this.currentProvider;
        }

        // Update trips list
        const clientList = document.getElementById('clientList');
        clientList.innerHTML = '';
        this.trips.forEach((trip, index) => {
            const item = document.createElement('div');
            item.className = 'trip-item';
            item.innerHTML = `
                <div class="trip-header">
                    <strong>Trip ${trip.tripNumber}</strong>
                    <div class="trip-actions">
                        <div class="action-group">
                            <div class="action-title">Include in calculation</div>
                            <label class="include-checkbox" title="Include this trip in calculations">
                                <input type="checkbox" ${trip.included !== false ? 'checked' : ''} 
                                       onchange="calculator.toggleTripInclusion(${index})">
                                <span class="checkmark"></span>
                            </label>
                        </div>
                        <div class="action-group">
                            <div class="action-title">Delete trip</div>
                            <button onclick="calculator.removeTrip(${index})" class="remove-btn" title="Delete this trip">×</button>
                        </div>
                    </div>
                </div>
                <div class="trip-details">
                    <div class="trip-stops">
                        <strong>Stops:</strong> ${trip.stops.length > 0 ? trip.stops.map(stop => typeof stop === 'object' && stop.address ? stop.address : stop).join(', ') : 'None'}
                    </div>
                    <div class="trip-route">
                        <strong>Route:</strong> Home → ${trip.stops.length > 0 ? trip.stops.map(stop => typeof stop === 'object' && stop.address ? stop.address : stop).join(' → ') + ' → ' : ''}${trip.notReturnHome ? 'End' : 'Home'}
                    </div>
                </div>
            `;
            clientList.appendChild(item);
        });

        // Update trip count
        const clientCount = document.getElementById('clientCount');
        if (clientCount) {
            clientCount.textContent = this.trips.length;
        }

        // Update current trip stops list
        const intermediateList = document.getElementById('intermediateList');
        if (intermediateList) {
            intermediateList.innerHTML = '';
            this.currentTripStops.forEach((address, index) => {
                const item = document.createElement('div');
                item.className = 'intermediate-item';
                item.innerHTML = `
                    <span>${address.address}</span>
                    <button onclick="calculator.removeIntermediateStop(${index})" class="remove-btn">×</button>
                `;
                intermediateList.appendChild(item);
            });
        }

        // Update intermediate stops count
        const intermediateCount = document.getElementById('intermediateCount');
        if (intermediateCount) {
            intermediateCount.textContent = this.currentTripStops.length;
        }
    }

    /**
     * Setup event listeners for distance inputs
     */
    setupDistanceInputListeners() {
        document.querySelectorAll('.distance-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const newDistance = parseFloat(e.target.value) || 0;
                
                // Update the specific result
                this.currentResults[index].distance = newDistance;
                
                // Recalculate totals
                this.recalculateTotals();
            });
        });
    }

    /**
     * Format duration in hours and minutes
     * @param {number} minutes - Duration in minutes
     * @returns {string} Formatted duration string
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = Math.round(minutes % 60);
            if (remainingMinutes === 0) {
                return `${hours}h`;
            } else {
                return `${hours}h ${remainingMinutes}min`;
            }
        }
    }

    /**
     * Recalculate totals based on current results
     */
    recalculateTotals() {
        let totalDistance = 0;
        let totalReimbursement = 0;
        
        this.currentResults.forEach(result => {
            if (!result.error) {
                totalDistance += result.distance;
                totalReimbursement += result.distance * this.pricePerKm;
            }
        });
        
        // Update summary display
        const totalDistanceElement = document.getElementById('totalDistance');
        const totalReimbursementElement = document.getElementById('totalReimbursement');
        
        if (totalDistanceElement) {
            totalDistanceElement.textContent = totalDistance.toFixed(1);
        }
        if (totalReimbursementElement) {
            totalReimbursementElement.textContent = '$' + totalReimbursement.toFixed(2);
        }
        
        // Update reimbursement cells
        this.currentResults.forEach((result, index) => {
            if (!result.error) {
                const row = document.querySelector(`.results-table tbody tr[data-index="${index}"]`);
                if (row) {
                    const reimbursementCell = row.querySelector('.reimbursement-cell');
                    if (reimbursementCell) {
                        reimbursementCell.textContent = '$' + (result.distance * this.pricePerKm).toFixed(2);
                    }
                }
            }
        });
        
        // Update per-trip total rows
        const tripGroups = {};
        this.currentResults.forEach(result => {
            if (!tripGroups[result.tripNumber]) {
                tripGroups[result.tripNumber] = [];
            }
            tripGroups[result.tripNumber].push(result);
        });
        // Update all trip total rows
        const allTripTotalRows = document.querySelectorAll('.results-table tbody tr.trip-total');
        Object.keys(tripGroups).forEach(tripNumber => {
            const tripResults = tripGroups[tripNumber];
            const tripTotalDistance = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.distance), 0);
            const tripTotalDuration = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.duration), 0);
            const tripTotalReimbursement = tripResults.reduce((sum, result) => sum + (result.error ? 0 : result.reimbursement), 0);
            // Find the correct trip total row for this trip
            allTripTotalRows.forEach(row => {
                const firstCell = row.querySelector('td:first-child strong');
                if (firstCell && firstCell.textContent.includes(`Trip ${tripNumber} Total`)) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 7) {
                        // Distance
                        cells[4].innerHTML = `<strong>${tripTotalDistance.toFixed(1)} km</strong>`;
                        // Duration
                        cells[5].innerHTML = `<strong><span class="trip-total-duration">${this.formatDuration(tripTotalDuration)}</span></strong>`;
                        // Reimbursement
                        cells[6].innerHTML = `<strong>$${tripTotalReimbursement.toFixed(2)}</strong>`;
                    }
                }
            });
        });
        
        // Store updated totals
        this.currentTotalDistance = totalDistance;
        this.currentTotalReimbursement = totalReimbursement;
    }



    /**
     * Add manual distance entry for API errors
     * @param {number} index - Index of the result to add manual distance
     */
    addManualDistance(index) {
        const row = document.querySelector(`.results-table tbody tr[data-index="${index}"]`);
        if (row && this.currentResults[index].error) {
            // Create input field for manual distance entry
            const distanceCell = row.querySelector('td:nth-child(3)');
            if (distanceCell) {
                distanceCell.innerHTML = `
                    <input type="number" class="distance-input" value="0" step="0.1" min="0" data-index="${index}" placeholder="Enter distance">
                    <button class="save-manual-btn" onclick="calculator.saveManualDistance(${index})">Save</button>
                `;
                
                // Add event listener for the new input
                const input = distanceCell.querySelector('.distance-input');
                input.addEventListener('input', (e) => {
                    const newDistance = parseFloat(e.target.value) || 0;
                    this.currentResults[index].distance = newDistance;
                    this.currentResults[index].error = null; // Clear error
                    this.recalculateTotals();
                });
            }
        }
    }

    /**
     * Save manual distance entry
     * @param {number} index - Index of the result to save
     */
    saveManualDistance(index) {
        const row = document.querySelector(`.results-table tbody tr[data-index="${index}"]`);
        if (row) {
            const input = row.querySelector('.distance-input');
            const newDistance = parseFloat(input.value) || 0;
            
            this.currentResults[index].distance = newDistance;
            this.currentResults[index].error = null;
            
            // Update the display
            this.recalculateTotals();
            
            // Show success message
            this.showSuccess(`Manual distance saved: ${newDistance.toFixed(1)} km`);
        }
    }

    /**
     * Setup event listeners for return home checkboxes
     */
    setupReturnHomeCheckboxListeners() {
        document.querySelectorAll('.return-home-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const tripNumber = parseInt(e.target.dataset.trip);
                const notReturnHome = e.target.checked;
                
                // Update the trip's notReturnHome setting
                const trip = this.trips.find(t => t.tripNumber === tripNumber);
                if (trip) {
                    trip.notReturnHome = notReturnHome;
                    this.saveData();
                    
                    // Recalculate the entire trip
                    await this.recalculateTrip(tripNumber);
                }
            });
        });
    }

    /**
     * Recalculate a specific trip
     * @param {number} tripNumber - The trip number to recalculate
     */
    async recalculateTrip(tripNumber) {
        const trip = this.trips.find(t => t.tripNumber === tripNumber);
        if (!trip) return;

        try {
            const tripRoute = this.buildTripRoute(trip);
            const newResults = [];
            
            // Calculate distances for this trip
            for (let i = 0; i < tripRoute.length - 1; i++) {
                const fromAddress = tripRoute[i];
                const toAddress = tripRoute[i + 1];
                
                // Leg description for error reporting
                let legDescription = '';
                if (i === 0) {
                    legDescription = 'Home → First Stop';
                } else if (i === tripRoute.length - 2) {
                    legDescription = 'Last Stop → Home';
                } else {
                    legDescription = `Stop ${i} → Stop ${i + 1}`;
                }
                try {
                    const result = await this.calculateSingleDistance(fromAddress, toAddress, trip.tripNumber, legDescription);
                    newResults.push({
                        tripNumber: trip.tripNumber,
                        from: fromAddress,
                        to: toAddress,
                        distance: result.distance,
                        duration: result.duration,
                        reimbursement: result.distance * this.pricePerKm,
                        ...(result.fallback ? { fallback: true } : {})
                    });
                } catch (error) {
                    console.error(`Error calculating distance from ${fromAddress} to ${toAddress}:`, error);
                    newResults.push({
                        tripNumber: trip.tripNumber,
                        from: fromAddress,
                        to: toAddress,
                        distance: 0,
                        duration: 0,
                        reimbursement: 0,
                        error: error.message
                    });
                }
            }
            
            // Update the current results for this trip
            this.currentResults = this.currentResults.filter(r => r.tripNumber !== tripNumber);
            this.currentResults.push(...newResults);
            
            // Recalculate totals and update display
            this.recalculateTotals();
            this.updateResultsDisplay();
            
        } catch (error) {
            console.error('Trip recalculation error:', error);
            this.showError(`Failed to recalculate trip ${tripNumber}: ${error.message}`);
        }
    }

    /**
     * Update the results display without recalculating everything
     */
    updateResultsDisplay() {
        const resultsContainer = document.getElementById('results');
        const summary = resultsContainer.querySelector('.results-summary');
        
        if (summary) {
            // Update just the summary with new totals
            const totalDistanceElement = summary.querySelector('#totalDistance');
            const totalReimbursementElement = summary.querySelector('#totalReimbursement');
            
            if (totalDistanceElement) {
                totalDistanceElement.textContent = this.currentTotalDistance.toFixed(1);
            }
            if (totalReimbursementElement) {
                totalReimbursementElement.textContent = '$' + this.currentTotalReimbursement.toFixed(2);
            }
        }
    }

    // Add a function to renumber all trips
    renumberTrips() {
        this.trips.forEach((trip, idx) => {
            trip.tripNumber = idx + 1;
        });
    }
}

// Initialize the calculator when the page loads
let calculator;
document.addEventListener('DOMContentLoaded', () => {
    calculator = new DistanceCalculator();
}); 