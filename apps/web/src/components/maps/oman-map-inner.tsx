"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function clampToBounds(
  lat: number,
  lng: number,
  bounds: { south: number; west: number; north: number; east: number },
) {
  return {
    lat: Math.min(bounds.north, Math.max(bounds.south, lat)),
    lng: Math.min(bounds.east, Math.max(bounds.west, lng)),
  };
}

function DraggableMarker({
  lat,
  lng,
  bounds,
  onDragEnd,
}: {
  lat: number;
  lng: number;
  bounds: { south: number; west: number; north: number; east: number };
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  const applyPosition = (rawLat: number, rawLng: number) => {
    const { lat: cLat, lng: cLng } = clampToBounds(rawLat, rawLng, bounds);
    const marker = markerRef.current;
    if (marker) marker.setLatLng([cLat, cLng]);
    onDragEnd(cLat, cLng);
  };

  useMapEvents({
    click(e) {
      applyPosition(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      draggable
      position={[lat, lng]}
      icon={pinIcon}
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const m = markerRef.current;
          if (!m) return;
          const pos = m.getLatLng();
          applyPosition(pos.lat, pos.lng);
        },
      }}
    />
  );
}

function FitBounds({
  bounds,
}: {
  bounds: { south: number; west: number; north: number; east: number };
}) {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]));
    map.setMinZoom(6);
  }, [map, bounds]);
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

/** Zoom in on the pin whenever `focusKey` changes (e.g. a pasted location). */
function FocusZoom({ lat, lng, focusKey }: { lat: number; lng: number; focusKey: number }) {
  const map = useMap();
  const latest = useRef({ lat, lng });
  latest.current = { lat, lng };
  useEffect(() => {
    if (!focusKey) return;
    map.setView([latest.current.lat, latest.current.lng], 16, { animate: true });
  }, [focusKey, map]);
  return null;
}

export default function OmanMapInner({
  lat,
  lng,
  bounds,
  onPositionChange,
  focusKey = 0,
}: {
  lat: number;
  lng: number;
  bounds: { south: number; west: number; north: number; east: number };
  onPositionChange: (lat: number, lng: number) => void;
  focusKey?: number;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={12}
      minZoom={7}
      maxBoundsViscosity={1.0}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds bounds={bounds} />
      <Recenter lat={lat} lng={lng} />
      <FocusZoom lat={lat} lng={lng} focusKey={focusKey} />
      <DraggableMarker lat={lat} lng={lng} bounds={bounds} onDragEnd={onPositionChange} />
    </MapContainer>
  );
}
