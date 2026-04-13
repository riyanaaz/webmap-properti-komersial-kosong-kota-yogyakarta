// ==========================================
// 1. FUNGSI MODAL PANDUAN & LIGHTBOX FOTO
// ==========================================
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


// ==========================================
// 2. INISIALISASI PETA DASAR (BASEMAP)
// ==========================================
const map = L.map('map', { zoomControl: false, tap: false }).setView([-7.7956, 110.3695], 13);
L.control.zoom({ position: 'bottomleft' }).addTo(map);

// Menggunakan Google Maps Standard
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, 
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps | Riyana Ajizah - S1 Teknik Geodesi UGM'
}).addTo(map);

let markerCluster, allMarkers = [];


// ==========================================
// 3. FUNGSI BANTUAN (HELPER FUNCTIONS)
// ==========================================

// A. Fungsi ekstrak koordinat GeoJSON (Point, Polygon, dll)
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

// B. Fungsi konversi format tanggal angka jadi teks bahasa Indonesia
function formatTanggalIndo(tanggalString) {
    if (!tanggalString || tanggalString === '-') return '-';

    let dateObj = new Date(tanggalString);

    // Cek jika formatnya DD-MM-YYYY atau DD/MM/YYYY
    if (isNaN(dateObj.getTime())) {
        const parts = tanggalString.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) { // Tahun ada di belakang
                dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }
    }

    if (isNaN(dateObj.getTime())) return tanggalString; // Jika gagal, kembalikan teks asli

    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const tanggal = dateObj.getDate();
    const bulan = namaBulan[dateObj.getMonth()];
    const tahun = dateObj.getFullYear();

    return `${tanggal} ${bulan} ${tahun}`;
}

// C. Fungsi ubah teks huruf besar semua (ALL CAPS) jadi Title Case
function toTitleCase(str) {
    if (typeof str !== 'string' || str === '-') return str;
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}


// ==========================================
// 4. PEMUATAN DATA SPASIAL & MARKER
// ==========================================
async function loadMapData() {
    try {
        // --- Memuat Batas Administrasi ---
        const batasRes = await fetch('data/batas.geojson');
        if (batasRes.ok) {
            const batasGeo = await batasRes.json();
            // Layer outline putih (glow)
            L.geoJSON(batasGeo, { style: { color: '#FFFFFF', weight: 6 } }).addTo(map);
            // Layer outline hitam putus-putus
            L.geoJSON(batasGeo, { style: { color: '#000000', weight: 3, dashArray: '15, 6, 2, 6, 2, 6' } }).addTo(map);
        }

        // --- Memuat Data Properti ---
        const propRes = await fetch('data/properti.geojson');
        if (!propRes.ok) throw new Error('properti.geojson tidak ditemukan');
        const propGeo = await propRes.json();
        console.log('GeoJSON loaded:', propGeo);

        if (!propGeo.features || !Array.isArray(propGeo.features)) {
            throw new Error('GeoJSON tidak memiliki features');
        }

        // --- Inisialisasi Marker Cluster ---
        markerCluster = L.markerClusterGroup({
            disableClusteringAtZoom: 18,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            showCoverageOnHover: false
        });

        let successCount = 0;

        propGeo.features.forEach((feature, idx) => {
            try {
                // Ekstraksi Koordinat
                const coordsArray = extractCoordinates(feature.geometry);
                if (!coordsArray || coordsArray.length < 2) {
                    console.warn(`Fitur ${idx}: tidak bisa ekstrak koordinat`, feature.geometry);
                    return;
                }

                let lng = coordsArray[0];
                let lat = coordsArray[1];
                if (isNaN(lat) || isNaN(lng)) return; // Lewati jika koordinat error
                
                const latlng = L.latLng(lat, lng);
                const props = feature.properties || {};
                
                // Variabel untuk fitur pencarian
                const namaJalan = props.nama_jalan || '-';
                const jenisProperti = props.jenis_properti || '-';
                const foto = props.foto || props.FOTO || null;

                // Desain Icon Marker Custom
                const icon = L.divIcon({
                    className: 'marker-ico',
                    html: '<div class="marker-bulet"><i class="fas fa-store"></i></div>',
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                    popupAnchor: [0, -17]
                });
                
                const marker = L.marker(latlng, { icon: icon });

                // --- KONFIGURASI POP-UP ---
                let popupHTML = '<div class="popup-custom">';
                
                // Jika ada foto, tambahkan ke pop-up
                if (foto) {
                    popupHTML += `<div class="popup-img-container"><img src="foto/${foto}" class="popup-img" onclick="openLightbox(this.src)" onerror="this.style.display='none'"></div>`;
                }
                
                // Urutan Atribut (Makro -> Mikro)
                const orderedFields = [
                    { key: 'id', label: 'ID' },
                    { key: 'wadmkc', label: 'Kecamatan' },
                    { key: 'wadmkd', label: 'Kelurahan' },
                    { key: 'nama_jalan', label: 'Nama Jalan' },
                    { key: 'jenis_jalan', label: 'Jenis Jalan' },
                    { key: 'tipologi_lokasi', label: 'Tipologi Lokasi' },
                    { key: 'lingkungan_sekitar', label: 'Lingkungan Sekitar' },
                    { key: 'jenis_properti', label: 'Jenis Properti' },
                    { key: 'fungsi_awal_properti', label: 'Fungsi Awal Properti' },
                    { key: 'bulan_kosong', label: 'Bulan Awal Kosong' },
                    { key: 'tahun_kosong', label: 'Tahun Awal Kosong' },
                    { key: 'tanggal_pendataan', label: 'Tanggal Pendataan' }
                ];

                popupHTML += '<table class="popup-table">';
                
                orderedFields.forEach(field => {
                    let value = (props[field.key] !== undefined && props[field.key] !== null && props[field.key] !== '') ? props[field.key] : '-';
                    
                    // Eksekusi fungsi helper untuk format data
                    if (value !== '-') {
                        if (field.key === 'tanggal_pendataan') {
                            value = formatTanggalIndo(value); // Ubah format tanggal
                        } else if (field.key === 'wadmkc' || field.key === 'wadmkd') {
                            value = toTitleCase(value); // Ubah jadi Title Case
                        }

                        // Buat baris tabel pop-up
                        popupHTML += `<tr style="border-bottom:1px solid #eee;">
                                        <td class="attribute-key">${field.label}</td>
                                        <td class="attribute-separator">:</td>
                                        <td class="attribute-value">${value}</td>
                                      </tr>`;
                    }
                });
                
                popupHTML += '</table></div>';
                
                // Sematkan pop-up ke marker
                marker.bindPopup(popupHTML, {
                    maxWidth: 320,      
                    minWidth: 260,      
                    autoPanPaddingTopLeft: [20, 140],
                    autoPanPaddingBottomRight: [20, 20]
                });
                
                // Event buka pop-up saat diklik
                marker.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    this.openPopup();
                });

                // Simpan data untuk kebutuhan fitur Search Panel
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
                console.error(`Error memproses fitur ke-${idx}:`, err);
            }
        });

        console.log(`Berhasil memproses ${successCount} titik properti dari ${propGeo.features.length} fitur data`);
        
        if (successCount === 0) {
            alert('Tidak ada titik data properti yang valid untuk ditampilkan. Cek struktur geometry di file properti.geojson');
            return;
        }

        // Tampilkan angka total ke modal awal
        const elementTotal = document.getElementById('teksTotalProperti');
        if (elementTotal) {
            elementTotal.innerText = successCount;
        }

        // Masukkan semua marker ke dalam Cluster lalu ke Peta
        markerCluster.addLayers(allMarkers);
        map.addLayer(markerCluster);
        
        // Paskan tampilan peta agar memuat semua titik
        if (markerCluster.getBounds().isValid()) {
            map.fitBounds(markerCluster.getBounds());
        }

        // Inisialisasi Search Panel
        setupDropdowns();

    } catch (err) {
        console.error('Error loadMapData:', err);
        alert('Terjadi kesalahan saat memuat data: ' + err.message);
    }
}


// ==========================================
// 5. FUNGSI PENCARIAN & FILTER PETA
// ==========================================
function setupDropdowns() {
    const inputJalan = document.getElementById('searchJalan');
    const inputJenis = document.getElementById('searchJenis');
    const dropdownJalan = document.getElementById('dropdownJalan');
    const dropdownJenis = document.getElementById('dropdownJenis');
    const clearJalan = document.getElementById('clearJalan');
    const clearJenis = document.getElementById('clearJenis');

    // Tampilkan/Sembunyikan tombol 'X' penghapus pencarian
    function updateClearButtons() {
        if (clearJalan) clearJalan.style.display = inputJalan.value.trim() !== '' ? 'flex' : 'none';
        if (clearJenis) clearJenis.style.display = inputJenis.value.trim() !== '' ? 'flex' : 'none';
    }

    // Dropdown Nama Jalan
    function renderJalan(filter = '') {
        const filterJenis = inputJenis.value.toLowerCase().trim();
        let items = new Set();
        
        allMarkers.forEach(m => {
            if (!filterJenis || m.featureData.jenis.includes(filterJenis)) {
                items.add(m.featureData.jalanAsli);
            }
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

    // Dropdown Jenis Properti
    function renderJenis(filter = '') {
        const filterJalan = inputJalan.value.toLowerCase().trim();
        let items = new Set();
        
        allMarkers.forEach(m => {
            if (!filterJalan || m.featureData.jalan.includes(filterJalan)) {
                items.add(m.featureData.jenisAsli);
            }
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

    // Fungsi utama mengeksekusi filter marker di peta
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

    // Event Listener Input Pencarian
    inputJalan.addEventListener('input', () => { renderJalan(inputJalan.value); filterMap(); updateClearButtons(); });
    inputJalan.addEventListener('focus', () => renderJalan(inputJalan.value));
    inputJalan.addEventListener('blur', () => setTimeout(() => dropdownJalan.style.display = 'none', 200));

    inputJenis.addEventListener('input', () => { renderJenis(inputJenis.value); filterMap(); updateClearButtons(); });
    inputJenis.addEventListener('focus', () => renderJenis(inputJenis.value));
    inputJenis.addEventListener('blur', () => setTimeout(() => dropdownJenis.style.display = 'none', 200));

    // Fungsi khusus untuk menghapus teks TANPA menghilangkan fokus kursor
    const handleClear = (inputElem, renderFunc, e) => {
        e.preventDefault(); // Mencegah input blur (keyboard HP tetap terbuka & dropdown tidak hilang)
        inputElem.value = '';
        renderFunc(''); // Langsung tampilkan semua daftar pilihan kembali
        filterMap();
        updateClearButtons();
        inputElem.focus(); // Pastikan kursor tetap berkedip di dalam kotak
    };

    // Event Listener Tombol Silang (Clear)
    if (clearJalan) {
        clearJalan.addEventListener('mousedown', (e) => handleClear(inputJalan, renderJalan, e));
        clearJalan.addEventListener('touchstart', (e) => handleClear(inputJalan, renderJalan, e), { passive: false });
    }
    
    if (clearJenis) {
        clearJenis.addEventListener('mousedown', (e) => handleClear(inputJenis, renderJenis, e));
        clearJenis.addEventListener('touchstart', (e) => handleClear(inputJenis, renderJenis, e), { passive: false });
    }

    updateClearButtons();
}


// ==========================================
// 6. LEGENDA PETA
// ==========================================
const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
        <h4>Legenda</h4>
        <div class="legend-item">
            <div class="legend-icon-properti"><i class="fas fa-store"></i></div>
            <span>Properti Komersial Kosong</span>
        </div>
        <div class="legend-item">
            <svg width="40" height="14" xmlns="http://www.w3.org/2000/svg" style="margin-right: 12px; flex-shrink: 0;">
                <line x1="0" y1="7" x2="40" y2="7" stroke="#FFFFFF" stroke-width="6" />
                <line x1="0" y1="7" x2="40" y2="7" stroke="#000000" stroke-width="3" stroke-dasharray="8, 4, 2, 4, 2, 4" stroke-linecap="round" />
            </svg>
            <span>Batas Administrasi Kota Yogyakarta</span>
        </div>`;
    return div;
};
legend.addTo(map);


// ==========================================
// 7. JALANKAN PROGRAM
// ==========================================
loadMapData();