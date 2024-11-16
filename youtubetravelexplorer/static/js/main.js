// static/js/main.js
console.log('Initializing map application');

const map = L.map('map').setView([20, 0], 2);
let selectedCountry = null;

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
                    searchVideos(selectedCountry);
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

let debounceTimeout;

// Debounce function to prevent multiple rapid calls
function debounce(func, delay) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, delay);
}

function searchVideos(country) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;

    console.log(`Searching videos for:`, { country, language, category });

    // Call debounce with a function that performs the fetch
    debounce(() => {
        fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country, language, category }),
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
    if (selectedCountry) searchVideos(selectedCountry);
});

document.getElementById('category').addEventListener('change', () => {
    console.log('Category changed:', document.getElementById('category').value);
    if (selectedCountry) searchVideos(selectedCountry);
});

console.log('Application initialization complete');