// static/js/main.js
console.log('Initializing map application');

let map = L.map('map').setView([0, 0], 2);
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
            onEachFeature: function(feature, layer) {
                layer.on('click', function() {
                    console.log(`Country selected: ${feature.properties.ADMIN}`);
                    selectedCountry = feature.properties.ADMIN;
                    searchVideos(feature.properties.ADMIN);
                });
                
                layer.on('mouseover', function() {
                    layer.setStyle({
                        fillOpacity: 0.7
                    });
                });
                
                layer.on('mouseout', function() {
                    layer.setStyle({
                        fillOpacity: 0.3
                    });
                });
            }
        }).addTo(map);
        console.log('Country layer added to map');
    })
    .catch(error => console.error('Error loading country boundaries:', error));

function searchVideos(country) {
    const language = document.getElementById('language').value;
    const category = document.getElementById('category').value;
    
    console.log(`Searching videos for:`, {
        country: country,
        language: language,
        category: category
    });
    
    fetch('/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            country: country,
            language: language,
            category: category
        })
    })
    .then(response => {
        console.log('Received response from server');
        return response.json();
    })
    .then(data => {
        console.log('Received video data:', data);
        if (data.error) {
            console.error('Error from server:', data.error);
            alert(`Error: ${data.error}`);
        } else {
            displayVideos(data.videos);
        }
    })
    .catch(error => {
        console.error('Error fetching videos:', error);
        alert('Error fetching videos. Please try again.');
    });
}

function displayVideos(videos) {
    console.log(`Displaying ${videos.length} videos`);
    const videosList = document.getElementById('videos-list');
    videosList.innerHTML = '';
    
    videos.forEach((video, index) => {
        console.log(`Processing video ${index + 1}:`, video.title);
        const videoElement = document.createElement('div');
        videoElement.className = 'video-item';
        videoElement.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}">
            <h3>${video.title}</h3>
            <p>${video.channelTitle}</p>
            <small>Published: ${new Date(video.publishedAt).toLocaleDateString()}</small>
        `;
        
        videoElement.addEventListener('click', () => {
            console.log(`Opening video: ${video.videoId}`);
            window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
        });
        
        videosList.appendChild(videoElement);
    });
}

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