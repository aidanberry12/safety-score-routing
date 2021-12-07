/**
 * Runs the leaflet map, which must initialize at startup, then allow updating via utility functions.
 */

import * as leaflet from "leaflet";
import * as d3 from "d3";
import clusters from "./accident_hotspots.js";

let map;
let routeMarkers = null;

/**
 * Center the map on one specific point, scrolling there instead of jumping.
 */
export const centerMap = (map, pos) => {
  map.panTo(new leaflet.LatLng(pos.latitude, pos.longitude));
};

/**
 * Called once and only once on mount of the main app.
 */
export const initLeaflet = (expandClusterCallback) => {
  if (map) {
    return;
  }

  map = leaflet.map("leaflet-map-element").setView({ lon: 37.0902, lat: -95.7129 }, 10);

  // Prompt the user for their current location - argument is callback function
  navigator.geolocation.getCurrentPosition((pos) => centerMap(map, pos.coords));

  // add the tiles - OpenStreetMap raster, mapbox road overlay, and scale controls
  leaflet
    .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
    .addTo(map);

  leaflet
    .tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: "mapbox/streets-v11",
      tileSize: 512,
      zoomOffset: -1,
      accessToken: process.env.REACT_APP_MAPBOX_TOKEN,
    })
    .addTo(map);

  leaflet.control.scale({ imperial: true, metric: true }).addTo(map);

  // Add clusters
  const clusterColors = d3
    .scaleSequential()
    .domain(d3.extent(clusters, (d) => d.avg_severity))
    .interpolator(d3.interpolateOrRd);

  clusters.forEach(({ cluster_id, avg_severity, centroid_latitude, centroid_longitude }) => {
    const color = clusterColors(avg_severity);
    const circle = leaflet
      .circleMarker([centroid_latitude, centroid_longitude], {
        // pane: 'markers1',
        radius: 7,
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        zIndexOffset: 2000,
        avg_severity,
        cluster_id,
      })
      .bindPopup(`<div> <strong>Average accident severity: </strong> ${avg_severity.toFixed(2)}</div>`)
      .on("mouseover", (event) => {
        event.target.openPopup();
      })
      .on("mouseout", (event) => {
        event.target.closePopup();
      })
      .on("click", expandClusterCallback)
      .addTo(map);
  });

  // This is the cleanup operation
  return () => {
    map.off();
    map.remove();
    map = null;
  };
};

/**
 * Display a set of 1-3 routes on the map, selecting the first one as a default.
 */
export const showRoutes = (bounds, routes, selectRouteCallback) => {
  if (!bounds || !routes || !routes.length) {
    console.error("Invalid arguments to showRoutes()");
    return;
  }

  // Remove any existing markers
  if (routeMarkers) {
    routeMarkers.forEach(section => section.forEach(marker => map.removeLayer(marker)));
  }

  var group = new leaflet.featureGroup(bounds.map((e) => leaflet.marker([e.lat, e.lng])));

  map.fitBounds(group.getBounds());

  // First is circles, second is array of 1-3 lines
  routeMarkers = Array(2);
  routeMarkers[0] = [];
  routeMarkers[1] = [];

  // Add two circles to the map, for start and dest
  [0, routes[0].length - 1].forEach((idx) => {
    const marker = leaflet.circleMarker([routes[0][idx].lat, routes[0][idx].lng], {
      radius: 5,
      fillColor: "blue",
      color: "blue",
      weight: 1,
      opacity: 1,
      fillOpacity: 1,
      zIndexOffset: 3000,
    });

    routeMarkers[0].push(marker);
    marker.addTo(map);
  });

  // Add 1-3 lines to the map, for the routes
  routes.forEach((points, idx) => {
    const marker = new leaflet.Polyline(
      points.map((e) => new leaflet.LatLng(e.lat, e.lng)),
      {
        color: idx === 0 ? "#669df6" : "#bbbbbb",
        // color: idx === 0 ? '#aacff9' : '#bbbbbb',
        opacity: 1.0,
        weight: 5,
        smoothFactor: 1,
        zIndexOffset: idx === 0 ? 1000 : 0,
      }
    ).on("click", () => selectRouteCallback(idx));

    routeMarkers[1].push(marker);
    marker.addTo(map);
  });

  // Bring the first route, and the two circles, to the front
  routeMarkers[1][0].bringToFront();
  routeMarkers[0][0].bringToFront();
  routeMarkers[0][1].bringToFront();
};

/**
 * Select a new route out of the 1-3 options, highlighting it and dimming the others.
 */
export const selectRoute = (activeIdx) => {
  if (!routeMarkers || routeMarkers[1].length <= activeIdx) {
    console.error("Invalid arguments to selectRoute()");
    return;
  }

  routeMarkers[1].forEach((marker, idx) => {
    if (idx === activeIdx) {
      marker.bringToFront();
    }
    marker.setStyle({
      color: idx === activeIdx ? "#669df6" : "#bbbbbb",
    });
  });

  // Send the start/end dots to the front of zIndex
  routeMarkers[0].forEach((circle) => {
    circle.bringToFront();
  });
};
