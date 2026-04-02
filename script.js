// script buat buka-tutup modal panduan pas awal loading
function closeModal() {
    const modal = document.getElementById('guideModal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; modal.style.opacity = '1'; }, 300);
}

function openModal() {
    const modal = document.getElementById('guideModal');
    modal.style.display = 'flex';
}

// script biar foto di popup bisa dizoom kalau diklik
function openLightbox(imageSrc) {
    const overlay = document.getElementById('lightboxOverlay');
    const img = document.getElementById('lightboxImage');
    img.src = imageSrc;
    overlay.classList.add('show-lightbox');
}

function closeLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    overlay.style.opacity = '0'; 
    setTimeout(() => { 
        overlay.classList.remove('show-lightbox'); 
        overlay.style.opacity = ''; 
    }, 300);
}

// setup awal leaflet, matikan zoom kiri atas, set view ke koordinat tengah jogja
const map = L.map('map', {
    zoomControl: false 
}).setView([-7.7956, 110.3695], 13);

// Pindahkan zoom control ke kiri bawah (agar aman tidak nabrak search bar di HP & di atas tombol panduan)
L.control.zoom({ position: 'bottomleft' }).addTo(map);

// pakai basemap dari google maps & UPDATE CREDIT TITLE
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, 
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], 
    attribution: '© Google Maps | Riyana Ajizah - S1 Teknik Geodesi UGM'
}).addTo(map);

let propertiLayer; 
let markerClusterGroup; // Variabel global untuk grup cluster
let allMarkers = []; // array ini buat nampung semua titik biar gampang difilter nanti

// Fungsi untuk mengubah ukuran icon saat di-zoom
map.on('zoomend', function() {
    var zoom = map.getZoom();
    
    // Rumus skala: Anggap zoom 14 adalah ukuran normal (scale 1)
    var scale = 1 + ((zoom - 14) * 0.4); 
    
    // Batasi ukuran supaya tidak terlalu raksasa saat di-zoom maksimal, atau hilang saat zoom out
    if (scale < 0.6) scale = 0.6; 
    if (scale > 3.0) scale = 3.0; 
    
    // Kirim nilai skala ke CSS
    document.documentElement.style.setProperty('--icon-scale', scale);
});

// Panggil fungsi sekali saat peta pertama dimuat agar ukurannya langsung menyesuaikan
map.fire('zoomend');

// ngerapiin nama field dari atribut geojson biar enak dibaca di popup
const aliasField = {
    "awalkosong": "Bulan Kosong",
    "thnkosong": "Tahun Kosong",
    "id": "ID",
    "nama jln": "Nama Jalan",
    "nama_jln": "Nama Jalan",
    "jenis jln": "Jenis Jalan",
    "jenis_jln": "Jenis Jalan",
    "jenisprope": "Jenis Properti",
    "fungsisblm": "Fungsi Awal Properti",
    "kondisifis": "Kondisi Fisik Properti",
    "deketpusat": "Dekat Pusat",
    "linksekit": "Lingkungan Sekitar",
    "lingksekit": "Lingkungan Sekitar" 
};

async function loadMapData() {
    try {
        // panggil data batas administrasi (geojson)
        const batasRes = await fetch('data/batas.geojson'); 
        if (batasRes.ok) {
            const batasGeoJSON = await batasRes.json();
            L.geoJSON(batasGeoJSON, { style: { color: '#FFFFFF', weight: 6, opacity: 1, fillColor: 'none', fillOpacity: 0 } }).addTo(map);
            L.geoJSON(batasGeoJSON, { style: { color: '#000000', weight: 3, opacity: 1, dashArray: '15, 6, 2, 6, 2, 6', lineCap: 'round', lineJoin: 'round', fillColor: 'none', fillOpacity: 0 } }).addTo(map);
        }

        // panggil data titik properti (geojson)
        const propertiRes = await fetch('data/properti.geojson');
        if (propertiRes.ok) {
            const propertiGeoJSON = await propertiRes.json();
            
            // Inisialisasi Marker Cluster dengan kustomisasi CSS
            markerClusterGroup = L.markerClusterGroup({
                iconCreateFunction: function(cluster) {
                    let childCount = cluster.getChildCount();
                    // Mengubah ukuran bulatan cluster berdasarkan jumlah titik
                    let size = childCount < 10 ? 35 : childCount < 30 ? 45 : 55;
                    return new L.DivIcon({
                        html: '<div><span>' + childCount + '</span></div>',
                        className: 'custom-cluster',
                        iconSize: new L.Point(size, size)
                    });
                },
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
            });

            propertiLayer = L.geoJSON(propertiGeoJSON, {
                pointToLayer: function (feature, latlng) {
                    // custom icon marker jadi bulet merah
                    let iconProperti = L.divIcon({ className: 'marker-properti', html: '<div class="marker-properti"><i class="fas fa-store"></i></div>', iconSize: [0, 0], iconAnchor: [0, 0]});
                    return L.marker(latlng, { icon: iconProperti });
                },
                onEachFeature: function (feature, layer) {
                    allMarkers.push(layer); // simpan ke array buat filter

                    let props = feature.properties;
                    let namaJalan = (props['Nama Jln'] || props.Nama_Jln || "-");
                    let jenisProperti = (props.Jenisprope || "-"); 
                    let namaFoto = props.foto || props.FOTO; 

                    // build isi html buat popupnya
                    let popupContent = `<div class="popup-custom">`;
                    
                    if (namaFoto) {
                        popupContent += `<div class="popup-img-container"><img src="foto/${namaFoto}" class="popup-img" title="Klik untuk memperbesar foto" onclick="openLightbox(this.src)" onerror="this.parentElement.style.display='none';"></div>`;
                    }
                    
                    popupContent += `<table style="width: 100%; border-collapse: collapse;">`;
                    
                    for (let key in props) {
                        let lowerKey = key.toLowerCase();
                        if (lowerKey !== 'foto' && lowerKey !== 'nama' && props[key] !== null && props[key] !== '') {
                            let labelTampil = aliasField[lowerKey] || key;
                            popupContent += `<tr style="border-bottom: 1px solid #eee;"><td class="attribute-key">${labelTampil}</td><td class="attribute-value">${props[key]}</td></tr>`;
                        }
                    }
                    popupContent += `</table></div>`;
                    
                    layer.bindPopup(popupContent, {
                        autoPanPaddingTopLeft: [20, 140], 
                        autoPanPaddingBottomRight: [20, 20]
                    });
                    
                    let titikTengah = layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
                    
                    // nyimpen info spesifik tiap titik biar gampang diakses waktu user nge-filter
                    layer.featureData = {
                        jalanAsli: namaJalan,
                        jenisAsli: jenisProperti,
                        jalan: namaJalan.toLowerCase(),
                        jenis: jenisProperti.toLowerCase(),
                        titik: titikTengah
                    };
                }
            }); // Tidak pakai .addTo(map) di sini

            // Tambahkan layer titik properti ke dalam keranjang Cluster, lalu tambahkan ke map
            markerClusterGroup.addLayer(propertiLayer);
            map.addLayer(markerClusterGroup);

            // zoom map biar ngepas ke semua titik properti (sekarang pakai getBounds dari markerClusterGroup)
            if (markerClusterGroup.getBounds().isValid()) {
                map.fitBounds(markerClusterGroup.getBounds());
            }

            // jalanin fungsi buat dropdown kalau datanya udah selesai diload
            setupDropdown('searchJalan', 'dropdownJalan', 'jalan', 'fa-road');
            setupDropdown('searchJenis', 'dropdownJenis', 'jenis', 'fa-tag');
        }
    } catch (error) { 
        console.error("Waduh, gagal load data geojson nih:", error); 
    }
}

loadMapData();

// nambahin box legenda
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
        <h4>Legenda</h4>
        <div class="legend-item"><div class="legend-icon-properti"><i class="fas fa-store"></i></div><span>Properti Komersial Kosong</span></div>
        <div class="legend-item"><svg width="40" height="14" xmlns="http://www.w3.org/2000/svg" style="margin-right: 12px; flex-shrink: 0;"><line x1="0" y1="7" x2="40" y2="7" stroke="#FFFFFF" stroke-width="6" /><line x1="0" y1="7" x2="40" y2="7" stroke="#000000" stroke-width="3" stroke-dasharray="8, 4, 2, 4, 2, 4" stroke-linecap="round" /></svg><span>Batas Administrasi Kota Yogyakarta</span></div>
    `;
    return div;
};
legend.addTo(map);

// ==========================================
// SCRIPT FILTER & TOMBOL RESET PENCARIAN
// ==========================================
const inputJalan = document.getElementById('searchJalan');
const inputJenis = document.getElementById('searchJenis');
const btnClearJalan = document.getElementById('clearJalan');
const btnClearJenis = document.getElementById('clearJenis');

// Fungsi untuk memunculkan/menyembunyikan tombol silang (reset)
function updateClearButtons() {
    if(btnClearJalan) btnClearJalan.style.display = inputJalan.value.trim() !== '' ? 'block' : 'none';
    if(btnClearJenis) btnClearJenis.style.display = inputJenis.value.trim() !== '' ? 'block' : 'none';
}

// Aksi ketika tombol silang diklik (Reset Input & Peta)
if (btnClearJalan) {
    btnClearJalan.addEventListener('click', () => {
        inputJalan.value = '';
        updateClearButtons();
        filterMap();
    });
}

if (btnClearJenis) {
    btnClearJenis.addEventListener('click', () => {
        inputJenis.value = '';
        updateClearButtons();
        filterMap();
    });
}

function filterMap() {
    const queryJalan = inputJalan.value.toLowerCase().trim();
    const queryJenis = inputJenis.value.toLowerCase().trim();
    
    let visibleBounds = L.latLngBounds();
    let hasVisibleMarkers = false;
    let matchedMarkers = []; // Array untuk menampung marker yang lolos filter

    allMarkers.forEach(marker => {
        const data = marker.featureData;
        const cocokJalan = (queryJalan === '' || data.jalan.includes(queryJalan));
        const cocokJenis = (queryJenis === '' || data.jenis.includes(queryJenis));

        // kalau cocok dua-duanya, masukkan ke array matchedMarkers
        if (cocokJalan && cocokJenis) {
            matchedMarkers.push(marker);
            visibleBounds.extend(data.titik);
            hasVisibleMarkers = true;
        }
    });

    // PENTING: Bersihkan cluster lama, lalu masukkan hasil filter yang baru
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
        markerClusterGroup.addLayers(matchedMarkers);
    }

    // auto zoom ke area titik-titik hasil pencarian
    if (hasVisibleMarkers && (queryJalan !== '' || queryJenis !== '')) {
        map.fitBounds(visibleBounds, { padding: [50, 50], maxZoom: 17, duration: 1.0 });
    } else if (queryJalan === '' && queryJenis === '') {
        // balikin zoom ke awal kalau inputan kosong semua
        if (markerClusterGroup && markerClusterGroup.getBounds().isValid()) {
            map.fitBounds(markerClusterGroup.getBounds(), { duration: 1.0 });
        }
    }
}

// fungsi buat nampilin list dropdown (cascading / saling nyambung)
function setupDropdown(inputId, dropdownId, type, iconClass) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    function renderList(filterText) {
        dropdown.innerHTML = '';
        const textLower = filterText.toLowerCase();

        let currentDataArray = [];
        
        // kalau user nyari jalan, listnya nyesuain sama jenis properti yang udah dipilih sebelahnya
        if (type === 'jalan') {
            const queryJenis = inputJenis.value.toLowerCase().trim();
            let availableJalan = new Set();
            
            allMarkers.forEach(marker => {
                if (queryJenis === '' || marker.featureData.jenis.includes(queryJenis)) {
                    availableJalan.add(marker.featureData.jalanAsli);
                }
            });
            currentDataArray = Array.from(availableJalan).sort();
            
        } 
        // sebaliknya, kalau milih jenis, nyesuain sama nama jalan yang udah diketik
        else if (type === 'jenis') {
            const queryJalan = inputJalan.value.toLowerCase().trim();
            let availableJenis = new Set();
            
            allMarkers.forEach(marker => {
                if (queryJalan === '' || marker.featureData.jalan.includes(queryJalan)) {
                    availableJenis.add(marker.featureData.jenisAsli);
                }
            });
            currentDataArray = Array.from(availableJenis).sort();
        }

        // saring lagi sesuai text yang diketik user
        const filtered = currentDataArray.filter(item => item.toLowerCase().includes(textLower));
        
        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<i class="fas ${iconClass}"></i> <span class="dropdown-text">${item}</span>`;
            
            // pas listnya diklik, masukin valuenya ke input, tutup dropdown, terus jalanin filter
            div.addEventListener('mousedown', function() { 
                input.value = item;
                dropdown.style.display = 'none';
                updateClearButtons(); // Menampilkan tombol silang jika ada isinya
                filterMap(); 
            });
            
            dropdown.appendChild(div);
        });
        
        dropdown.style.display = 'flex';
    }

    input.addEventListener('input', () => {
        renderList(input.value);
        updateClearButtons(); // Cek tombol silang setiap kali ngetik
        filterMap(); 
    });

    input.addEventListener('focus', () => {
        renderList(input.value);
    });
    
    input.addEventListener('blur', () => {
        // dikasih delay dikit biar pas user klik listnya gak keburu ilang
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}
