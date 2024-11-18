console.log('Initializing map application');

const map = L.map('map').setView([20, 0], 2);
let selectedCountry = null;
let selectedCity = null;
let cityMarkers = [];

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
                    selectedCity = null;
                    fetchMajorCities(selectedCountry);
                    fetchWikiSummary(selectedCountry);
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
        citiesConfig = data;
        console.log('Cities configuration loaded successfully');
    })
    .catch(error => console.error('Error loading cities configuration:', error));

function fetchMajorCities(country) {
    console.log(`Fetching major cities for: ${country}`);
    cityMarkers.forEach(marker => map.removeLayer(marker));
    cityMarkers = [];
    const icon = L.icon({
        iconUrl: 'static/Angle Up_3.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    if (citiesConfig[country]) {
        console.log(`Found cities for ${country}:`, citiesConfig[country]);
        setTimeout(() => {
            citiesConfig[country].forEach(city => {
                console.log(`Adding city: ${city.name} at ${city.coords}`);
                const marker = L.marker(city.coords, { icon: icon }).addTo(map);
                marker.bindPopup(city.name, {
                    offset: L.point(0, -20)
                });
                marker.bindTooltip(city.name, {
                    permanent: false,
                    direction: 'top',
                    opacity: 0.8
                });

                marker.on('click', () => {
                    console.log(`City selected: ${city.name}`);
                    selectedCity = city.name;
                    searchVideos(country, selectedCity);
                    fetchWeather(city.coords, city.name);
                    fetchWikiSummary(selectedCity);
                });

                cityMarkers.push(marker);
            });
        }, 100);
    } else {
        console.log(`No major cities found for ${country}, searching by country instead.`);
        selectedCity = null;
        searchVideos(country, selectedCity);
    }
}

function fetchWeather(coords, cityName) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current_weather=true`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Weather data not found');
            return response.json();
        })
        .then(data => {
            const temperatureC = data.current_weather.temperature;
            const temperatureF = (temperatureC * 9/5) + 32;
            displayWeather(cityName, temperatureC, temperatureF);
        })
        .catch(error => console.error('Error fetching weather data:', error));
}

function displayWeather(cityName, tempC, tempF) {
    const weatherInfo =
        `<div>
            <h3>${cityName}</h3>
            <p>Temperature: <span id="temp-display">${tempC} °C</span></p>
            <button id="toggle-temp">Switch to °F</button>
        </div>`
    ;

    const popup = L.popup()
        .setLatLng(cityMarkers.find(marker => marker.getPopup().getContent().includes(cityName)).getLatLng())
        .setContent(weatherInfo)
        .openOn(map);

    const toggleButton = document.getElementById('toggle-temp');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const tempDisplay = document.getElementById('temp-display');
            if (tempDisplay.innerText.includes('°C')) {
                tempDisplay.innerText = `${tempF.toFixed(1)} °F`;
                toggleButton.innerText = 'Switch to °C';
            } else {
                tempDisplay.innerText = `${tempC} °C`;
                toggleButton.innerText = 'Switch to °F';
            }
        });
    }
}

map.on('click', (e) => {
    if (!countryLayer.getBounds().contains(e.latlng)) {
        cityMarkers.forEach(marker => map.removeLayer(marker));
        cityMarkers = [];
    } else if (selectedCountry) {
        searchVideos(selectedCountry, selectedCity);
    }
});

let debounceTimeout;

function debounce(func, delay) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, delay);
}

function generateCacheKey(country, city, language, category) {
    return `${country}-${city || 'no-city'}-${language}-${category}`;
}

function searchVideos(country, city) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;

    console.log('Searching videos for:', { country, language, category, city });

    const searchQuery = city ? `${city}, ${country} ${language} ${category}` : `${country} ${language} ${category}`;
    const cacheKey = generateCacheKey(country, city, language, category);

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const { videos, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (now - timestamp < oneHour) {
            console.log('Returning cached results');
            displayVideos(videos);
            return;
        } else {
            console.log('Cached data expired, removing from localStorage');
            localStorage.removeItem(cacheKey);
        }
    }

    const videoContainer = document.getElementById('video-container');
    videoContainer.innerHTML = '';

    const loadingOverlay = document.getElementById('loading');
    setTimeout(() => {
        loadingOverlay.classList.remove('hidden');
    }, 100);

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
            loadingOverlay.classList.add('hidden');

            if (data.error) {
                console.error('Error from server:', data.error);
                alert(`Error: ${data.error}`);
            } else {
                localStorage.setItem(cacheKey, JSON.stringify({
                    videos: data.videos,
                    timestamp: Date.now(),
                }));
                displayVideos(data.videos);
            }
        })
        .catch(error => {
            loadingOverlay.classList.add('hidden');
            console.error('Error fetching videos:', error);
            alert('Error fetching videos');
        });
    }, 500);
}

function displayVideos(videos) {
    console.log('Displaying videos:', videos);
    const videoContainer = document.getElementById('video-container');

    if (!videoContainer) {
        console.error('Video container not found');
        return;
    }

    videoContainer.innerHTML = '';

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
        videoContainer.innerHTML = '<p>No videos found.</p>';
    }
}

function fetchWikiSummary(title) {
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
