// static/js/main.js
console.log('Initializing map application');

const map = L.map('map').setView([20, 0], 2);
let selectedCountry = null;
let selectedCity = null; // Variable to hold the selected city
let cityMarkers = []; // Array to hold city markers

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

console.log('Map initialized');

let countryLayer;

// Load GeoJSON data for country boundaries
console.log('Fetching country boundaries');
fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        console.log('Received country boundaries response');
        return response.json();
    })
    .then(data => {
        console.log(`Loaded ${data.features.length} country features`);
        countryLayer = L.geoJSON(data, {
            style: {
                fillColor: '#3388ff',
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                layer.bindTooltip(feature.properties.ADMIN, {
                    permanent: false,
                    direction: 'top',
                    opacity: 0.8
                });

                layer.on('click', () => {
                    console.log(`Country selected: ${feature.properties.ADMIN}`);
                    selectedCountry = feature.properties.ADMIN;
                    fetchMajorCities(selectedCountry); // Fetch and display major cities
                });
                
                layer.on('mouseover', (e) => {
                    layer.setStyle({ fillOpacity: 0.7 });
                    layer.openTooltip();
                    const tooltip = layer.getTooltip();
                    if (tooltip) {
                        tooltip.setLatLng(e.latlng);
                    }
                });
                
                layer.on('mouseout', () => {
                    layer.setStyle({ fillOpacity: 0.3 });
                    layer.closeTooltip();
                });
            }
        }).addTo(map);
        console.log('Country layer added to map');
    })
    .catch(error => console.error('Error loading country boundaries:', error));

// Load major cities from the configuration file
let citiesConfig = {};

fetch('/static/cities_config.json')
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        citiesConfig = data; // Store the cities configuration
        console.log('Cities configuration loaded successfully');
    })
    .catch(error => console.error('Error loading cities configuration:', error));

// Function to fetch major cities based on the selected country
function fetchMajorCities(country) {
    console.log(`Fetching major cities for: ${country}`); // Debug log
    // Clear existing city markers
    cityMarkers.forEach(marker => map.removeLayer(marker));
    cityMarkers = [];

    // Check if the country exists in the configuration
    if (citiesConfig[country]) {
        console.log(`Found cities for ${country}:`, citiesConfig[country]); // Debug log
        setTimeout(() => {
            citiesConfig[country].forEach(city => {
                console.log(`Adding city: ${city.name} at ${city.coords}`); // Debug log
                const marker = L.marker(city.coords).addTo(map);
                marker.bindPopup(city.name);
                marker.on('click', () => {
                    console.log(`City selected: ${city.name}`);
                    selectedCity = city.name; // Set the selected city
                    searchVideos(country, selectedCity); // Trigger search for the selected city
                });
                cityMarkers.push(marker); // Store the marker for later removal
            });
        }, 100); // Delay of 100ms
    } else {
        console.log(`No major cities found for ${country}, searching by country instead.`);
        selectedCity = null; // Reset selected city if no cities found
        searchVideos(country, selectedCity); // Trigger search by country
    }
}

// Remove city markers when clicking outside the country
map.on('click', (e) => {
    // Check if the click is outside the country layer
    if (!countryLayer.getBounds().contains(e.latlng)) {
        cityMarkers.forEach(marker => map.removeLayer(marker));
        cityMarkers = [];
    } else if (selectedCountry) {
        // If a country is selected, trigger search for the country
        searchVideos(selectedCountry, selectedCity); // Trigger search with the selected city
    }
});

let debounceTimeout;

// Debounce function to prevent multiple rapid calls
function debounce(func, delay) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, delay);
}

function generateCacheKey(country, city, language, category) {
    return `${country}-${city || 'no-city'}-${language}-${category}`; // Unique key based on search parameters
}

function searchVideos(country, city) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;

    console.log(`Searching videos for:`, { country, language, category, city });

    // Construct the search query to include the city if it exists
    const searchQuery = city ? `${city}, ${country} ${language} ${category}` : `${country} ${language} ${category}`;
    const cacheKey = generateCacheKey(country, city, language, category);

    // Check if the result is already cached in localStorage
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const { videos, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // One hour in milliseconds

        // Check if the cached data is still valid (less than one hour old)
        if (now - timestamp < oneHour) {
            console.log('Returning cached results');
            displayVideos(videos);
            return;
        } else {
            console.log('Cached data expired, removing from localStorage');
            localStorage.removeItem(cacheKey); // Remove expired cache
        }
    }

    // Call debounce with a function that performs the fetch
    debounce(() => {
        fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country, language, category, city }),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error('Error from server:', data.error);
                alert(`Error: ${data.error}`);
            } else {
                // Cache the results with a timestamp
                const cacheValue = {
                    videos: data.videos,
                    timestamp: Date.now() // Store the current timestamp
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheValue));
                displayVideos(data.videos);
            }
        })
        .catch(error => console.error('Error fetching videos:', error));
    }, 500); // 500ms delay
}

const displayVideos = (videos) => {
    console.log(`Displaying ${videos.length} videos`);
    const videosList = document.getElementById('videos-list');
    videosList.innerHTML = '';
    
    videos.forEach((video, index) => {
        console.log(`Processing video ${index + 1}:`, video.title);
        const videoElement = document.createElement('div');
        videoElement.className = 'video-item border rounded-lg shadow-md p-4 cursor-pointer transition-transform transform hover:scale-105';
        videoElement.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-32 object-cover rounded-md mb-2">
            <h3 class="font-semibold text-lg">${video.title}</h3>
            <p class="text-gray-600">${video.channelTitle}</p>
            <small class="text-gray-500">Published: ${new Date(video.publishedAt).toLocaleDateString()}</small>
        `;
        
        videoElement.addEventListener('click', () => {
            console.log(`Opening video: ${video.videoId}`);
            window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
        });
        
        videosList.appendChild(videoElement);
    });
};

// Update results when language or category changes
document.getElementById('language').addEventListener('change', () => {
    console.log('Language changed:', document.getElementById('language').value);
    if (selectedCountry) searchVideos(selectedCountry, selectedCity);
});

document.getElementById('category').addEventListener('change', () => {
    console.log('Category changed:', document.getElementById('category').value);
    if (selectedCountry) searchVideos(selectedCountry, selectedCity);
});

console.log('Application initialization complete');