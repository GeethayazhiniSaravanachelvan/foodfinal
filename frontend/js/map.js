/**
 * Foodshare - Leaflet & OpenStreetMap Integration
 * Handles interactive location picking and live map browsing of surplus food listings.
 */

const MAP_HELPER = {
  /**
   * Creates custom HTML marker icon
   */
  createIcon(category = 'default', isUser = false) {
    if (isUser) {
      return L.divIcon({
        className: 'custom-map-marker marker-user',
        html: `
          <div style="
            background: #0284c7;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    }

    const categoryColors = {
      'Cooked Meals': '#e76f51',
      Bakery: '#f4a261',
      'Fresh Produce': '#2d6a4f',
      'Dairy & Eggs': '#2a9d8f',
      'Packaged & Canned': '#7209b7',
    };
    const color = categoryColors[category] || '#2d6a4f';

    return L.divIcon({
      className: 'custom-map-marker marker-food',
      html: `
        <div style="
          background: ${color};
          width: 34px;
          height: 34px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="transform: rotate(45deg); color: white; display:flex; align-items:center; justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32],
    });
  },

  /**
   * Initializes interactive location picker for Donors
   */
  initPickerMap(containerId, initialLat = 40.7397, initialLng = -73.9918, onSelect) {
    if (!window.L) {
      console.warn('Leaflet (L) library not loaded yet.');
      return null;
    }

    const map = L.map(containerId).setView([initialLat, initialLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    let marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: this.createIcon('Fresh Produce'),
    }).addTo(map);

    const updateLocation = async (lat, lng) => {
      marker.setLatLng([lat, lng]);
      if (onSelect) {
        onSelect({ lat, lng });
      }
    };

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateLocation(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      updateLocation(e.latlng.lat, e.latlng.lng);
    });

    return { map, marker };
  },

  /**
   * Initializes browse map for Recipients
   */
  initBrowseMap(containerId, centerLat = 40.7397, centerLng = -73.9918, radiusKm = 15) {
    if (!window.L) return null;

    const map = L.map(containerId).setView([centerLat, centerLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | Foodshare',
    }).addTo(map);

    // Recipient location marker
    const userMarker = L.marker([centerLat, centerLng], {
      icon: this.createIcon(null, true),
    }).addTo(map).bindPopup('<b>Your Location</b>');

    // Radius circle
    const radiusCircle = L.circle([centerLat, centerLng], {
      radius: radiusKm * 1000,
      color: '#40916c',
      fillColor: '#74c69d',
      fillOpacity: 0.12,
      weight: 1.5,
    }).addTo(map);

    const listingsLayerGroup = L.layerGroup().addTo(map);

    return {
      map,
      userMarker,
      radiusCircle,
      listingsLayerGroup,
      updateRadius(newKm) {
        radiusCircle.setRadius(newKm * 1000);
      },
      setCenter(lat, lng) {
        map.setView([lat, lng], map.getZoom());
        userMarker.setLatLng([lat, lng]);
        radiusCircle.setLatLng([lat, lng]);
      },
      renderListingMarkers(listings, onRequestClick) {
        listingsLayerGroup.clearLayers();

        listings.forEach((item) => {
          const coords = item.location?.coordinates || [];
          if (coords.length < 2) return;
          const [lng, lat] = coords;

          const marker = L.marker([lat, lng], {
            icon: MAP_HELPER.createIcon(item.category),
          });

          const expiryInfo = window.FOODSHARE_UI?.getExpiryStatus(item.expiresAt);

          const popupContent = `
            <div style="max-width: 220px; font-family: inherit;">
              ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%; height:90px; object-fit:cover; border-radius:6px; margin-bottom:6px;" />` : ''}
              <div style="font-weight:700; font-size:0.92rem; color:#1b4332; margin-bottom:2px;">${window.FOODSHARE_UI.escapeHtml(item.title)}</div>
              <div style="font-size:0.8rem; color:#526359; margin-bottom:4px;">${item.category} • <b>${item.remainingQuantity} ${item.unit}</b></div>
              <div style="font-size:0.75rem; margin-bottom:8px;">
                <span class="badge ${expiryInfo.badgeClass}">${expiryInfo.text}</span>
              </div>
              <button onclick="window.onMapRequest('${item._id}')" class="btn btn-primary btn-sm" style="width:100%; padding:4px 8px; font-size:0.78rem;">
                Request Food
              </button>
            </div>
          `;

          marker.bindPopup(popupContent);
          listingsLayerGroup.addLayer(marker);
        });
      },
    };
  },
};

window.FOODSHARE_MAP = MAP_HELPER;

