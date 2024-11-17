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
                    selectedCity = null; // Reset selected city when a new country is selected
                    fetchMajorCities(selectedCountry); // Fetch and display major cities
                    fetchWikiSummary(selectedCountry);  // Add this line to trigger the Wikipedia summary fetch

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
    function fetchMajorCities(country) {
        console.log(`Fetching major cities for: ${country}`); // Debug log
        // Clear existing city markers
        cityMarkers.forEach(marker => map.removeLayer(marker));
        cityMarkers = [];
        const icon = L.icon({
            iconUrl: 'static/Angle Up_3.png',
            iconSize: [32, 32],  // Adjust icon size
            iconAnchor: [16, 32],  // Anchor the icon at its bottom center
            popupAnchor: [0, -32]  // Position the popup above the marker
        });
        // Check if the country exists in the configuration
        if (citiesConfig[country]) {
            console.log(`Found cities for ${country}:`, citiesConfig[country]); // Debug log
            setTimeout(() => {
                citiesConfig[country].forEach(city => {
                    console.log(`Adding city: ${city.name} at ${city.coords}`); // Debug log
                    const marker = L.marker(city.coords, { icon: icon }).addTo(map);
                    marker.bindPopup(city.name, {
                        offset: L.point(0, -20)  // Adjust popup position if needed
                    });    
                    // Bind popup to the marker to show city name on click
                    marker.bindPopup(city.name);
    
                    // Bind tooltip to the marker to show city name on hover
                    marker.bindTooltip(city.name, {
                        permanent: false,
                        direction: 'top',
                        opacity: 0.8
                    });
    
                    marker.on('click', () => {
                        console.log(`City selected: ${city.name}`);
                        selectedCity = city.name;  // Set the selected city
                        searchVideos(country, selectedCity);  // Trigger search for all platforms
                        fetchWeather(city.coords, city.name);  // Fetch weather for the selected city using coordinates
                        fetchWikiSummary(selectedCity);  // Add this line to trigger the Wikipedia summary fetch

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
    

// Function to fetch weather data for a city using coordinates from cities_config.json
function fetchWeather(coords, cityName) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current_weather=true`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Weather data not found');
            return response.json();
        })
        .then(data => {
            const temperatureC = data.current_weather.temperature; // Temperature in Celsius
            const temperatureF = (temperatureC * 9/5) + 32; // Convert to Fahrenheit
            displayWeather(cityName, temperatureC, temperatureF); // Display weather info
        })
        .catch(error => console.error('Error fetching weather data:', error));
}

// Function to display weather information
function displayWeather(cityName, tempC, tempF) {
    const weatherInfo = 
        `<div>
            <h3>${cityName}</h3>
            <p>Temperature: <span id="temp-display">${tempC} °C</span></p>
            <button id="toggle-temp">Switch to °F</button>
        </div>`
    ;
    
    // Create a popup for the weather information
    const popup = L.popup()
        .setLatLng(cityMarkers.find(marker => marker.getPopup().getContent().includes(cityName)).getLatLng())
        .setContent(weatherInfo)
        .openOn(map);

    // Add event listener for the toggle button
    const toggleButton = document.getElementById('toggle-temp');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const tempDisplay = document.getElementById('temp-display');
            if (tempDisplay.innerText.includes('°C')) {
                tempDisplay.innerText = `${tempF.toFixed(1)} °F`; // Display Fahrenheit
                toggleButton.innerText = 'Switch to °C'; // Update button text
            } else {
                tempDisplay.innerText = `${tempC} °C`; // Display Celsius
                toggleButton.innerText = 'Switch to °F'; // Update button text
            }
        });
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

// Show loading overlay when a country or city is selected
function searchVideos(country, city) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;

    console.log('Searching videos for:', { country, language, category, city });

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

    // Clear previous videos before showing loading
    const videoContainer = document.getElementById('video-container');
    videoContainer.innerHTML = ''; // Clear previous videos

    // Show loading overlay with a slight delay
    const loadingOverlay = document.getElementById('loading');
    setTimeout(() => {
        loadingOverlay.classList.remove('hidden'); // Show loading overlay
    }, 100); // Delay to avoid flickering

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
            // Hide loading overlay
            loadingOverlay.classList.add('hidden'); // Hide loading overlay

            if (data.error) {
                console.error('Error from server:', data.error);
                alert(`Error: ${data.error}`);
            } else {
                // Cache the results with a timestamp
                localStorage.setItem(cacheKey, JSON.stringify({
                    videos: data.videos,
                    timestamp: Date.now(),
                }));
                displayVideos(data.videos);
            }
        })
        .catch(error => {
            loadingOverlay.classList.add('hidden'); // Hide loading overlay in case of error
            console.error('Error fetching videos:', error);
            alert('Error fetching videos');
        });
    }, 500); // Debounce the request to avoid rapid consecutive calls
}


// Function to display videos in the UI
function displayVideos(videos) {
    console.log('Displaying videos:', videos);
    const videoContainer = document.getElementById('video-container');
    
    if (!videoContainer) {
        console.error('Video container not found');
        return; // Exit if the container is not found
    }

    videoContainer.innerHTML = ''; // Clear previous videos

    // Check if there are videos in the response
    if (videos.youtube && videos.youtube.length > 0) {
        videos.youtube.forEach(video => {
            const videoElement = document.createElement('div');
            videoElement.className = 'video-item border rounded-lg shadow-md p-4 cursor-pointer transition-transform transform hover:scale-105';
            videoElement.innerHTML = `
                <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-32 object-cover rounded-md mb-2">
                <h3 class="font-semibold text-lg">${video.title}</h3>
                <p class="text-gray-600">${video.channelTitle}</p>`;
            
            videoElement.addEventListener('click', () => {
                console.log(`Opening video: ${video.url}`);
                window.open(`${video.url}`, '_blank');
            });
            
            videoContainer.appendChild(videoElement);
        });
    } else {
        videoContainer.innerHTML = '<p>No videos found.</p>'; // Handle no videos case
    }
}
function fetchWikiSummary(title) {
    // URL encode the title
    const encodedTitle = encodeURIComponent(title);

    fetch(`/wiki-summary/${encodedTitle}`)
        .then(response => response.json())
        .then(data => {
            if (data.summary) {
                document.getElementById('wiki-summary').innerHTML = data.summary;
            } else {
                document.getElementById('wiki-summary').innerHTML = 'Summary not available.';
            }
        })
        .catch(error => {
            console.error('Error fetching Wikipedia data:', error);
            document.getElementById('wiki-summary').innerHTML = 'Failed to fetch data.';
        });
}

