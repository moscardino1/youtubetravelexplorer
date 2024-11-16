// static/js/main.js
console.log('Initializing map application');

const map = L.map('map').setView([20, 0], 2);
let selectedCountry = null;
let selectedCity = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

console.log('Map initialized');

let countryLayer;

// Predefined major cities with coordinates
const majorCities = {
    "United States": [
        { name: "New York", coords: [40.7128, -74.0060] },
        { name: "Los Angeles", coords: [34.0522, -118.2437] },
        { name: "Chicago", coords: [41.8781, -87.6298] }
    ],
    "Canada": [
        { name: "Toronto", coords: [43.6510, -79.3470] },
        { name: "Vancouver", coords: [49.2827, -123.1207] },
        { name: "Montreal", coords: [45.5017, -73.5673] }
    ],
    "France": [
        { name: "Paris", coords: [48.8566, 2.3522] },
        { name: "Lyon", coords: [45.7640, 4.8357] },
        { name: "Marseille", coords: [43.2965, 5.3698] }
    ],
    "Germany": [
        { name: "Berlin", coords: [52.5200, 13.4050] },
        { name: "Munich", coords: [48.1351, 11.5820] },
        { name: "Frankfurt", coords: [50.1109, 8.6821] }
    ],
    // Add more countries and cities as needed
};

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
                    selectedCity = null; // Reset selected city
                    searchVideos(selectedCountry, null); // Trigger search with only the country
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

        // Plot major cities on the map
        plotMajorCities();
    })
    .catch(error => console.error('Error loading country boundaries:', error));

// Function to plot major cities on the map
function plotMajorCities() {
    for (const country in majorCities) {
        majorCities[country].forEach(city => {
            const marker = L.marker(city.coords).addTo(map);
            marker.bindPopup(city.name).on('click', () => {
                console.log(`City selected: ${city.name}`);
                selectedCity = city.name;
                searchVideos(country, selectedCity);
            });
        });
    }
}




let debounceTimeout;

// Debounce function to prevent multiple rapid calls
function debounce(func, delay) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, delay);
}

function generateCacheKey(country, city, language, category) {
    return `${country}-${city}-${language}-${category}`; // Unique key based on search parameters
}

function searchVideos(country, city) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;

    console.log(`Searching videos for:`, { country, language, category, city });

    // Construct the search query to include the city
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