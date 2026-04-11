function closeModal() {
    const modal = document.getElementById('guideModal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300);
}
function openModal() {
    document.getElementById('guideModal').style.display = 'flex';
}
function openLightbox(src) {
    const overlay = document.getElementById('lightboxOverlay');
    document.getElementById('lightboxImage').src = src;
    overlay.classList.add('show-lightbox');
}
function closeLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.classList.remove('show-lightbox'); overlay.style.opacity = ''; }, 300);
}

const map = L.map('map', { zoomControl: false, tap: false }).setView([-7.7956, 110.3695], 13);
L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps | Riyana Ajizah - S1 Teknik Geodesi UGM'
}).addTo(map);

let markerCluster, allMarkers = [];

// Fungsi untuk mengekstrak koordinat dari berbagai tipe geometri (Point, MultiPoint, LineString, Polygon, dll)
function extractCoordinates(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    const coords = geometry.coordinates;
    switch (geometry.type) {
        case 'Point': return coords;
        case 'MultiPoint': return coords[0];
        case 'LineString': return coords[0];
        case 'MultiLineString': return coords[0][0];
        case 'Polygon': return coords[0][0];
        case 'MultiPolygon': return coords[0][0][0];
        default: return null;
    }
}

async function loadMapData() {
    try {
        const batasRes = await fetch('data/batas.geojson');
        if (batasRes.ok) {
            const batasGeo = await batasRes.json();
            L.geoJSON(batasGeo, { style: { color: '#FFFFFF', weight: 6 } }).addTo(map);
            L.geoJSON(batasGeo, { style: { color: '#000000', weight: 3, dashArray: '15, 6, 2, 6, 2, 6' } }).addTo(map);
        }

        const propRes = await fetch('data/properti.geojson');
        if (!propRes.ok) throw new Error('properti.geojson tidak ditemukan');
        const propGeo = await propRes.json();
        console.log('GeoJSON loaded:', propGeo);

        if (!propGeo.features || !Array.isArray(propGeo.features)) {
            throw new Error('GeoJSON tidak memiliki features');
        }

        // Inisialisasi Marker Cluster
        markerCluster = L.markerClusterGroup({
            disableClusteringAtZoom: 18,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            showCoverageOnHover: false
        });

        let successCount = 0;
        propGeo.features.forEach((feature, idx) => {
            try {
                const coordsArray = extractCoordinates(feature.geometry);
                if (!coordsArray || coordsArray.length < 2) {
                    console.warn(`Fitur ${idx}: tidak bisa ekstrak koordinat`, feature.geometry);
                    return;
                }

                let lng = coordsArray[0];
                let lat = coordsArray[1];
                if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`Fitur ${idx}: koordinat NaN`, coordsArray);
                    return;
                }
                const latlng = L.latLng(lat, lng);

                const props = feature.properties || {};
                
                // --- PENYESUAIAN FIELD PENCARIAN & FILTER ---
                const namaJalan = props.nama_jalan || '-';
                const jenisProperti = props.jenis_properti || '-';
                const foto = props.foto || props.FOTO || null;

                const icon = L.divIcon({
                    className: 'marker-ico',
                    html: '<div class="marker-bulet"><i class="fas fa-store"></i></div>',
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                    popupAnchor: [0, -17]
                });
                const marker = L.marker(latlng, { icon: icon });

                // Popup dengan tabel dan foto
                let popupHTML = '<div class="popup-custom">';
                if (foto) {
                    popupHTML += `<div class="popup-img-container"><img src="foto/${foto}" class="popup-img" onclick="openLightbox(this.src)" onerror="this.style.display='none'"></div>`;
                }
                
                // --- PENYESUAIAN FIELD POP-UP ---
                const orderedFields = [
                    { key: 'id', label: 'ID' },
                    { key: 'nama_jalan', label: 'Nama Jalan' },
                    { key: 'jenis_jalan', label: 'Jenis Jalan' },
                    { key: 'jenis_properti', label: 'Jenis Properti' },
                    { key: 'fungsi_awal_properti', label: 'Fungsi Awal Properti' },
                    { key: 'bulan_kosong', label: 'Bulan Kosong' },
                    { key: 'tahun_kosong', label: 'Tahun Kosong' },
                    { key: 'tipologi_lokasi', label: 'Tipologi Lokasi' },
                    { key: 'lingkungan_sekitar', label: 'Lingkungan Sekitar' }
                ];

                popupHTML += '<table class="popup-table">';
                orderedFields.forEach(field => {
                    let value = (props[field.key] !== undefined && props[field.key] !== null && props[field.key] !== '') ? props[field.key] : '-';
                    
                    if (value !== '-') {
                        popupHTML += `<tr style="border-bottom:1px solid #eee;">
                                        <td class="attribute-key">${field.label}</td>
                                        <td class="attribute-separator">:</td>
                                        <td class="attribute-value">${value}</td>
                                      </tr>`;
                    }
                });
                popupHTML += '</table></div>';
                
                marker.bindPopup(popupHTML, {
                    maxWidth: 320,      
                    minWidth: 260,      
                    autoPanPaddingTopLeft: [20, 140],
                    autoPanPaddingBottomRight: [20, 20]
                });
                
                marker.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    this.openPopup();
                });

                marker.featureData = {
                    jalanAsli: namaJalan,
                    jenisAsli: jenisProperti,
                    jalan: namaJalan.toLowerCase(),
                    jenis: jenisProperti.toLowerCase(),
                    titik: latlng
                };
                allMarkers.push(marker);
                successCount++;
            } catch (err) {
                console.error(`Error fitur ${idx}:`, err);
            }
        });

        console.log(`Berhasil memproses ${successCount} marker dari ${propGeo.features.length} fitur`);
        
        if (successCount === 0) {
            alert('Tidak ada data properti yang valid. Periksa format geometry di properti.geojson (pastikan ada Point/MultiPoint).');
            return;
        }

        // Menampilkan total properti ke layar panduan awal
        const elementTotal = document.getElementById('teksTotalProperti');
        if (elementTotal) {
            elementTotal.innerText = successCount;
        }

        markerCluster.addLayers(allMarkers);
        map.addLayer(markerCluster);
        if (markerCluster.getBounds().isValid()) map.fitBounds(markerCluster.getBounds());

        setupDropdowns();
    } catch (err) {
        console.error('Error loadMapData:', err);
        alert('Gagal memuat data: ' + err.message);
    }
}

function setupDropdowns() {
    const inputJalan = document.getElementById('searchJalan');
    const inputJenis = document.getElementById('searchJenis');
    const dropdownJalan = document.getElementById('dropdownJalan');
    const dropdownJenis = document.getElementById('dropdownJenis');
    const clearJalan = document.getElementById('clearJalan');
    const clearJenis = document.getElementById('clearJenis');

    function updateClearButtons() {
        if (clearJalan) {
            clearJalan.style.display = inputJalan.value.trim() !== '' ? 'flex' : 'none';
        }
        if (clearJenis) {
            clearJenis.style.display = inputJenis.value.trim() !== '' ? 'flex' : 'none';
        }
    }

    function renderJalan(filter = '') {
        const filterJenis = inputJenis.value.toLowerCase().trim();
        let items = new Set();
        allMarkers.forEach(m => {
            if (!filterJenis || m.featureData.jenis.includes(filterJenis))
                items.add(m.featureData.jalanAsli);
        });
        const arr = Array.from(items).sort().filter(i => i.toLowerCase().includes(filter.toLowerCase()));
        dropdownJalan.innerHTML = '';
        if (arr.length === 0) {
            dropdownJalan.style.display = 'none';
            return;
        }
        arr.forEach(jalan => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<i class="fas fa-road"></i> <span class="dropdown-text">${jalan}</span>`;
            div.onmousedown = (e) => {
                e.preventDefault();
                inputJalan.value = jalan;
                dropdownJalan.style.display = 'none';
                filterMap();
                updateClearButtons();
            };
            dropdownJalan.appendChild(div);
        });
        dropdownJalan.style.display = 'flex';
    }

    function renderJenis(filter = '') {
        const filterJalan = inputJalan.value.toLowerCase().trim();
        let items = new Set();
        allMarkers.forEach(m => {
            if (!filterJalan || m.featureData.jalan.includes(filterJalan))
                items.add(m.featureData.jenisAsli);
        });
        const arr = Array.from(items).sort().filter(i => i.toLowerCase().includes(filter.toLowerCase()));
        dropdownJenis.innerHTML = '';
        if (arr.length === 0) {
            dropdownJenis.style.display = 'none';
            return;
        }
        arr.forEach(jenis => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<i class="fas fa-tag"></i> <span class="dropdown-text">${jenis}</span>`;
            div.onmousedown = (e) => {
                e.preventDefault();
                inputJenis.value = jenis;
                dropdownJenis.style.display = 'none';
                filterMap();
                updateClearButtons();
            };
            dropdownJenis.appendChild(div);
        });
        dropdownJenis.style.display = 'flex';
    }

    function filterMap() {
        const qJalan = inputJalan.value.toLowerCase().trim();
        const qJenis = inputJenis.value.toLowerCase().trim();
        const matched = allMarkers.filter(m => 
            (qJalan === '' || m.featureData.jalan.includes(qJalan)) &&
            (qJenis === '' || m.featureData.jenis.includes(qJenis))
        );
        markerCluster.clearLayers();
        markerCluster.addLayers(matched);
        if (matched.length) {
            const bounds = L.latLngBounds(matched.map(m => m.featureData.titik));
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50,50], maxZoom: 17 });
        } else if (!qJalan && !qJenis && allMarkers.length) {
            if (markerCluster.getBounds().isValid()) map.fitBounds(markerCluster.getBounds());
        }
    }

    inputJalan.addEventListener('input', () => {
        renderJalan(inputJalan.value);
        filterMap();
        updateClearButtons();
    });
    inputJalan.addEventListener('focus', () => renderJalan(inputJalan.value));
    inputJalan.addEventListener('blur', () => setTimeout(() => dropdownJalan.style.display = 'none', 200));

    inputJenis.addEventListener('input', () => {
        renderJenis(inputJenis.value);
        filterMap();
        updateClearButtons();
    });
    inputJenis.addEventListener('focus', () => renderJenis(inputJenis.value));
    inputJenis.addEventListener('blur', () => setTimeout(() => dropdownJenis.style.display = 'none', 200));

    if (clearJalan) {
        clearJalan.addEventListener('click', () => {
            inputJalan.value = '';
            renderJalan('');
            filterMap();
            updateClearButtons();
            inputJalan.focus();
        });
    }
    if (clearJenis) {
        clearJenis.addEventListener('click', () => {
            inputJenis.value = '';
            renderJenis('');
            filterMap();
            updateClearButtons();
            inputJenis.focus();
        });
    }

    updateClearButtons();
}

const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `<h4>Legenda</h4>
        <div class="legend-item"><div class="legend-icon-properti"><i class="fas fa-store"></i></div><span>Properti Komersial Kosong</span></div>
        <div class="legend-item"><svg width="40" height="14" xmlns="http://www.w3.org/2000/svg" style="margin-right: 12px; flex-shrink: 0;"><line x1="0" y1="7" x2="40" y2="7" stroke="#FFFFFF" stroke-width="6" /><line x1="0" y1="7" x2="40" y2="7" stroke="#000000" stroke-width="3" stroke-dasharray="8, 4, 2, 4, 2, 4" stroke-linecap="round" /></svg><span>Batas Administrasi Kota Yogyakarta</span></div>`;
    return div;
};
legend.addTo(map);

loadMapData();
