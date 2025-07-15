/**
 * Address Validation System
 * 
 * Free address validation using existing APIs
 * Validates format, geocoding, and postal codes
 */
class AddressValidator {
    constructor() {
        this.postalCodeRegex = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
    }

    /**
     * Validate Canadian address format and content
     * @param {string} address - Address to validate
     * @returns {Object} Validation result
     */
    validateAddressFormat(address) {
        const errors = [];
        const warnings = [];

        // Check if address is empty
        if (!address || address.trim().length === 0) {
            errors.push('Address cannot be empty');
            return { isValid: false, errors, warnings };
        }

        // Check minimum length
        if (address.trim().length < 5) {
            warnings.push('Address seems too short');
        }

        // More lenient checks for real addresses
        const hasStreet = /\d+\s+[A-Za-z]/.test(address) || /[A-Za-z]+\s+\d+/.test(address);
        const hasCity = /[A-Za-z]+\s*,\s*[A-Z]{2}/.test(address) || /[A-Za-z]+\s*,\s*[A-Za-z]+/.test(address);
        const hasPostalCode = this.postalCodeRegex.test(address);

        // Only require street if no postal code (postal codes are often sufficient)
        if (!hasStreet && !hasPostalCode) {
            warnings.push('Address should include street number and name, or a postal code');
        }

        if (!hasCity) {
            warnings.push('Address should include city and province (e.g., Toronto, ON)');
        }

        if (!hasPostalCode) {
            warnings.push('Canadian postal code format: A1A 1A1');
        }

        return {
            isValid: true, // Be more lenient - let geocoding decide
            errors,
            warnings,
            hasStreet,
            hasCity,
            hasPostalCode
        };
    }

    /**
     * Validate Canadian postal code format
     * @param {string} postalCode - Postal code to validate
     * @returns {Object} Validation result
     */
    validatePostalCode(postalCode) {
        if (!postalCode) {
            return { isValid: false, error: 'Postal code is required' };
        }

        const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
        
        if (!this.postalCodeRegex.test(cleaned)) {
            return { 
                isValid: false, 
                error: 'Invalid postal code format. Use format: A1A 1A1',
                suggestion: this.formatPostalCode(cleaned)
            };
        }

        return { 
            isValid: true, 
            formatted: this.formatPostalCode(cleaned)
        };
    }

    /**
     * Format postal code with space
     * @param {string} postalCode - Raw postal code
     * @returns {string} Formatted postal code
     */
    formatPostalCode(postalCode) {
        const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
        if (cleaned.length === 6) {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
        }
        return cleaned;
    }

    /**
     * Comprehensive address validation
     * @param {string} address - Address to validate
     * @returns {Object} Complete validation result
     */
    async validateAddress(address) {
        const formatResult = this.validateAddressFormat(address);
        
        if (!formatResult.isValid) {
            return {
                isValid: false,
                errors: formatResult.errors,
                warnings: formatResult.warnings,
                confidence: 0
            };
        }

        // Extract postal code if present
        const postalCodeMatch = address.match(this.postalCodeRegex);
        let postalCodeResult = null;
        
        if (postalCodeMatch) {
            postalCodeResult = this.validatePostalCode(postalCodeMatch[0]);
            if (!postalCodeResult.isValid) {
                formatResult.errors.push(postalCodeResult.error);
            }
        }

        // Try to geocode the address to verify it exists
        try {
            const geocodeResult = await this.verifyWithGeocoding(address);
            
            return {
                isValid: formatResult.isValid && geocodeResult.isValid,
                errors: [...formatResult.errors, ...geocodeResult.errors],
                warnings: [...formatResult.warnings, ...geocodeResult.warnings],
                confidence: geocodeResult.confidence,
                verifiedAddress: geocodeResult.verifiedAddress,
                coordinates: geocodeResult.coordinates,
                postalCode: postalCodeResult?.formatted
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [...formatResult.errors, 'Could not verify address exists'],
                warnings: formatResult.warnings,
                confidence: 0
            };
        }
    }

    /**
     * Verify address exists using geocoding
     * @param {string} address - Address to verify
     * @returns {Object} Verification result
     */
    async verifyWithGeocoding(address) {
        try {
            // Use Nominatim for verification (free, no API key required)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `q=${encodeURIComponent(address)}&` +
                `countrycodes=CA&` +
                `format=json&` +
                `limit=3&` + // Get more results for better matching
                `addressdetails=1`
            );

            if (!response.ok) {
                return { isValid: false, errors: ['Geocoding service unavailable'] };
            }

            const data = await response.json();
            
            if (!data || data.length === 0) {
                return { 
                    isValid: false, 
                    errors: ['Address not found'],
                    confidence: 0 
                };
            }

            // Use the best match (first result)
            const result = data[0];
            const confidence = this.calculateConfidence(result, address);

            // Be more lenient - if we got any result, consider it valid
            const isValid = confidence > 0.3; // Lower threshold

            return {
                isValid,
                confidence,
                verifiedAddress: result.display_name,
                coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
                warnings: confidence < 0.7 ? ['Address may not be exact match'] : [],
                errors: isValid ? [] : ['Address not found or unclear']
            };
        } catch (error) {
            console.error('Geocoding verification error:', error);
            return { 
                isValid: false, 
                errors: ['Geocoding service unavailable'],
                confidence: 0 
            };
        }
    }

    /**
     * Calculate confidence score for geocoding result
     * @param {Object} geocodeResult - Geocoding result
     * @param {string} originalAddress - Original address
     * @returns {number} Confidence score (0-1)
     */
    calculateConfidence(geocodeResult, originalAddress) {
        let score = 0;
        
        // Check if city matches
        const originalCity = this.extractCity(originalAddress);
        const resultCity = geocodeResult.address?.city || geocodeResult.address?.town;
        
        if (originalCity && resultCity) {
            if (originalCity.toLowerCase() === resultCity.toLowerCase()) {
                score += 0.4;
            } else if (resultCity.toLowerCase().includes(originalCity.toLowerCase()) || 
                       originalCity.toLowerCase().includes(resultCity.toLowerCase())) {
                score += 0.2;
            }
        }
        
        // Check if province matches
        const originalProvince = this.extractProvince(originalAddress);
        const resultProvince = geocodeResult.address?.state;
        
        if (originalProvince && resultProvince) {
            if (originalProvince.toLowerCase() === resultProvince.toLowerCase()) {
                score += 0.3;
            }
        }
        
        // Check if postal code matches
        const originalPostal = originalAddress.match(this.postalCodeRegex);
        const resultPostal = geocodeResult.address?.postcode;
        
        if (originalPostal && resultPostal) {
            if (originalPostal[0].replace(/\s/g, '') === resultPostal.replace(/\s/g, '')) {
                score += 0.3;
            }
        }
        
        return Math.min(score, 1);
    }

    /**
     * Extract city from address
     * @param {string} address - Address to parse
     * @returns {string} City name
     */
    extractCity(address) {
        const cityMatch = address.match(/([A-Za-z\s]+),\s*[A-Z]{2}/);
        return cityMatch ? cityMatch[1].trim() : null;
    }

    /**
     * Extract province from address
     * @param {string} address - Address to parse
     * @returns {string} Province code
     */
    extractProvince(address) {
        const provinceMatch = address.match(/,\s*([A-Z]{2})/);
        return provinceMatch ? provinceMatch[1] : null;
    }
}

/**
 * Base API Provider Class
 * 
 * Handles API key management and common functionality
 */
class APIProvider {
    constructor() {
        this.apiKeys = {};
        this.loadAPIKeys();
    }

    /**
     * Load API keys from localStorage
     */
    loadAPIKeys() {
        const saved = localStorage.getItem('distanceCalculatorAPIKeys');
        if (saved) {
            this.apiKeys = JSON.parse(saved);
        }
    }

    /**
     * Save API keys to localStorage
     */
    saveAPIKeys() {
        localStorage.setItem('distanceCalculatorAPIKeys', JSON.stringify(this.apiKeys));
    }

    /**
     * Set API key for a provider
     * @param {string} provider - Provider name
     * @param {string} key - API key
     */
    setAPIKey(provider, key) {
        this.apiKeys[provider] = key;
        this.saveAPIKeys();
    }

    /**
     * Get current API key
     * @returns {string} Current API key
     */
    getCurrentAPIKey() {
        const userKey = this.apiKeys.openrouteservice || '';
        console.log('User key found:', userKey ? 'Yes' : 'No');
        console.log('User key length:', userKey ? userKey.length : 0);
        
        if (userKey && userKey.trim() !== '') {
            console.log('Using user key');
            return userKey;
        }
        // Fallback to demo key if no user key is set
        console.log('Using demo key fallback');
        return 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM1YmIxOWM4Y2FjNjQ4OGM5Yzk0OTY5YjQ1MzlmZjY3IiwiaCI6Im11cm11cjY0In0=';
    }

    /**
     * Set current provider
     * @param {string} provider - Provider name
     */
    setProvider(provider) {
        // Not used in single provider setup
    }

    /**
     * Get current provider
     * @returns {string} Current provider
     */
    getCurrentProvider() {
        return 'openrouteservice';
    }

    /**
     * Get all providers
     * @returns {Array} Array of provider names
     */
    getProviders() {
        return ['openrouteservice'];
    }

    /**
     * Clear API key for a provider
     * @param {string} provider - Provider name
     */
    clearAPIKey(provider) {
        delete this.apiKeys[provider];
        this.saveAPIKeys();
    }

    /**
     * Clear all API keys
     */
    clearAllAPIKeys() {
        this.apiKeys = {};
        this.saveAPIKeys();
    }

    /**
     * Validate address before processing
     * @param {string} address - Address to validate
     * @returns {Object} Validation result
     */
    async validateAddress(address) {
        const validator = new AddressValidator();
        return await validator.validateAddress(address);
    }
}

/**
 * OpenRouteService Provider
 * 
 * Free routing provider with basic geocoding.
 * 2,000 requests per day limit.
 * Excellent for routing, basic for geocoding.
 */
class OpenRouteServiceProvider extends APIProvider {
    constructor() {
        super();
        this.baseURL = 'https://api.openrouteservice.org/v2';
        this.ratelimitLimit = null;
        this.ratelimitRemaining = null;
    }

    /**
     * Get current API key with demo fallback
     * @returns {string} Current API key
     */
    getCurrentAPIKey() {
        const userKey = this.apiKeys.openrouteservice || '';
        // Removed noisy logs about user key presence and length
        if (userKey && userKey.trim() !== '') {
            return userKey;
        }
        // Fallback to demo key if no user key is set
        return 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM1YmIxOWM4Y2FjNjQ4OGM5Yzk0OTY5YjQ1MzlmZjY3IiwiaCI6Im11cm11cjY0In0=';
    }

    /**
     * Geocode address using Nominatim (free, CORS-friendly)
     * @param {string} query - Address to geocode
     * @param {string} country - Country code (default: CA)
     * @returns {Array} Array of geocoded results
     */
    async geocodeAddress(query, country = 'CA') {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=${country.toLowerCase()}&limit=10&addressdetails=1`);
            if (!response.ok) {
                throw new Error(`Nominatim geocoding failed: ${response.status}`);
            }
            const data = await response.json();
            if (!data || data.length === 0) {
                return [];
            }
            const results = data
                .filter(item => item.display_name && item.lat && item.lon)
                .map(item => ({
                    address: item.display_name,
                    coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
                    type: 'address'
                }))
                .filter((result, index, self) => 
                    index === self.findIndex(r => r.address === result.address)
                );
            return results;
        } catch (error) {
            // Only log unexpected geocoding errors
            if (error && error.name !== 'TypeError') {
                console.warn('Nominatim geocoding error:', error);
            }
            throw error;
        }
    }



    /**
     * Calculate driving distance using OpenRouteService
     * Avoids tolls and ignores traffic for consistent base distance
     * @param {Array} origin - [longitude, latitude] of origin
     * @param {Array} destination - [longitude, latitude] of destination
     * @param {Object} info - Optional: {tripNumber, legDescription, originAddress, destAddress}
     * @returns {Object} Distance and duration information
     */
    async calculateDistance(origin, destination, info = {}) {
        const apiKey = this.getCurrentAPIKey();
        if (!apiKey) {
            throw new Error('OpenRouteService API key is required');
        }
        // Try with increasing radiuses if 350m fails
        const radiiToTry = [350, 1000, 2000];
        let lastError = null;
        let originRadius = 350;
        let destRadius = 350;
        for (let attempt = 0; attempt < radiiToTry.length; attempt++) {
            try {
                const requestBody = {
                    coordinates: [origin, destination],
                    format: 'json',
                    units: 'km',
                    radiuses: [originRadius, destRadius]
                };
                const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
                this.ratelimitLimit = response.headers.get('x-ratelimit-limit');
                this.ratelimitRemaining = response.headers.get('x-ratelimit-remaining');
                if (!response.ok) {
                    const errorText = await response.text();
                    // Build a detailed error log
                    let context = '';
                    if (info && (info.tripNumber || info.legDescription)) {
                        context += `[Trip ${info.tripNumber || '?'}${info.legDescription ? ', Leg: ' + info.legDescription : ''}]\n`;
                    }
                    if (info && (info.originAddress || info.destAddress)) {
                        context += `Origin: ${info.originAddress || JSON.stringify(origin)}\nDestination: ${info.destAddress || JSON.stringify(destination)}\n`;
                    }
                    console.warn(`${context}OpenRouteService API error:`, response.status, errorText);
                    // If this is a 404 with a 350m radius error, try next radius
                    if (response.status === 404 && errorText.includes('within a radius of 350.0 meters')) {
                        // Parse which coordinate failed
                        let coordMatch = errorText.match(/coordinate (\d):/);
                        let coordIdx = coordMatch ? parseInt(coordMatch[1], 10) : null;
                        let which = coordIdx === 0 ? 'origin' : (coordIdx === 1 ? 'destination' : 'unknown');
                        // Only increase the radius for the problematic coordinate
                        if (attempt + 1 < radiiToTry.length && coordIdx !== null) {
                            let nextRadius = radiiToTry[attempt + 1];
                            if (coordIdx === 0) {
                                originRadius = nextRadius;
                            } else if (coordIdx === 1) {
                                destRadius = nextRadius;
                            }
                            console.warn(`Retrying with radius ${nextRadius}m for ${which} (coordinate ${coordIdx})...`);
                            lastError = errorText;
                            continue; // Try next radius
                        }
                        lastError = errorText;
                        continue; // If no more radii, will fallback
                    }
                    throw new Error(`OpenRouteService routing failed: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                if (!data.routes || data.routes.length === 0) {
                    throw new Error('No route found');
                }
                const route = data.routes[0];
                let distance;
                if (route.summary.distance > 1000) {
                    distance = route.summary.distance / 1000;
                } else {
                    distance = route.summary.distance;
                }
                const duration = route.summary.duration / 60;
                return {
                    distance: Math.round(distance * 100) / 100,
                    duration: Math.round(duration * 100) / 100,
                    route: route.geometry ? route.geometry.coordinates : [origin, destination]
                };
            } catch (error) {
                // Only log unexpected errors, not expected fallback
                if (!(error && error.message && error.message.startsWith('OpenRouteService routing failed: 404'))) {
                    let context = '';
                    if (info && (info.tripNumber || info.legDescription)) {
                        context += `[Trip ${info.tripNumber || '?'}${info.legDescription ? ', Leg: ' + info.legDescription : ''}]\n`;
                    }
                    if (info && (info.originAddress || info.destAddress)) {
                        context += `Origin: ${info.originAddress || JSON.stringify(origin)}\nDestination: ${info.destAddress || JSON.stringify(destination)}\n`;
                    }
                    console.warn(`${context}OpenRouteService routing error:`, error);
                }
                lastError = error;
                // If this was a fetch/parse error, don't retry
                break;
            }
        }
        // Fallback: Calculate straight-line distance if all radii fail
        const distance = this.calculateStraightLineDistance(origin, destination);
        const duration = distance * 2;
        return {
            distance: Math.round(distance * 100) / 100,
            duration: Math.round(duration * 100) / 100,
            route: [origin, destination],
            fallback: true
        };
    }

    /**
     * Calculate straight-line distance between two coordinates
     * @param {Array} origin - [longitude, latitude] of origin
     * @param {Array} destination - [longitude, latitude] of destination
     * @returns {number} Distance in kilometers
     */
    calculateStraightLineDistance(origin, destination) {
        const [lon1, lat1] = origin;
        const [lon2, lat2] = destination;
        
        // Convert to radians
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const deltaLat = (lat2 - lat1) * Math.PI / 180;
        const deltaLon = (lon2 - lon1) * Math.PI / 180;
        
        // Haversine formula
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        // Earth's radius in kilometers
        const earthRadius = 6371;
        
        return earthRadius * c;
    }

    getRateLimitInfo() {
        return {
            limit: this.ratelimitLimit,
            remaining: this.ratelimitRemaining
        };
    }
}

/**
 * API Provider Manager
 * 
 * Manages OpenRouteService provider and provides a unified interface.
 * Handles API key management.
 */
class APIProviderManager {
    constructor() {
        this.providers = {
            openrouteservice: new OpenRouteServiceProvider()
        };
        this.currentProvider = 'openrouteservice'; // Only OpenRouteService
        this.addressValidator = new AddressValidator(); // Add address validator
        
        // Default demo API key
        this.DEMO_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM1YmIxOWM4Y2FjNjQ4OGM5Yzk0OTY5YjQ1MzlmZjY3IiwiaCI6Im11cm11cjY0In0=';
    }

    // Get current provider instance
    getCurrentProvider() {
        return this.providers[this.currentProvider];
    }

    // Set current provider
    setProvider(providerName) {
        if (this.providers[providerName]) {
            this.currentProvider = providerName;
            return true;
        }
        return false;
    }

    // Get all available providers
    getAvailableProviders() {
        return Object.keys(this.providers);
    }

    // Get provider info for UI
    getProviderInfo() {
        const info = {
            openrouteservice: {
                name: 'OpenRouteService + Nominatim',
                description: 'Free routing with Nominatim geocoding',
                freeTier: '2,000 routing requests/day, unlimited geocoding',
                geocoding: 'Nominatim (free, CORS-friendly)',
                routing: 'OpenRouteService - Avoids tolls',
                requiresKey: true
            }
        };
        return info;
    }

    // Geocode address using current provider
    async geocodeAddress(query, country = 'CA') {
        return await this.getCurrentProvider().geocodeAddress(query, country);
    }

    // Calculate distance using current provider
    async calculateDistance(origin, destination, info = {}) {
        return await this.getCurrentProvider().calculateDistance(origin, destination, info);
    }

    // Get current API key
    getCurrentAPIKey() {
        const userKey = this.getCurrentProvider().getCurrentAPIKey();
        if (userKey && userKey.trim() !== '') {
            return userKey;
        }
        return this.DEMO_API_KEY;
    }

    // Set API key for current provider
    setCurrentAPIKey(key) {
        this.getCurrentProvider().setAPIKey(this.currentProvider, key);
    }

    // Get all API keys
    getAllAPIKeys() {
        const keys = {};
        Object.keys(this.providers).forEach(provider => {
            keys[provider] = this.providers[provider].getCurrentAPIKey();
        });
        return keys;
    }

    // Set API key for specific provider
    setAPIKey(provider, key) {
        if (this.providers[provider]) {
            this.providers[provider].setAPIKey(provider, key);
        }
    }

    // Clear API key for current provider
    clearCurrentAPIKey() {
        this.getCurrentProvider().clearAPIKey(this.currentProvider);
    }

    // Clear all API keys
    clearAllAPIKeys() {
        Object.values(this.providers).forEach(provider => {
            provider.clearAllAPIKeys();
        });
    }

    /**
     * Validate address before processing
     * @param {string} address - Address to validate
     * @returns {Object} Validation result
     */
    async validateAddress(address) {
        return await this.addressValidator.validateAddress(address);
    }
}

// Export the manager instance
const apiManager = new APIProviderManager(); 