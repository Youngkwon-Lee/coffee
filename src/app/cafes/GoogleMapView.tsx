import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

// Cafe 타입을 CafeClient에서 import하거나, 아래와 같이 정의(간단 버전)
export interface Cafe {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  // 필요한 추가 필드...
}

const containerStyle = {
  width: '100%',
  height: '400px',
};

export default function GoogleMapView({ cafes, center, onMarkerClick }: { cafes: Cafe[]; center: { lat: number; lng: number }; onMarkerClick?: (cafe: Cafe) => void }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  if (!isLoaded) return <div>지도를 불러오는 중...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
    >
      {cafes
        .filter(cafe =>
          typeof cafe.lat === "number" &&
          typeof cafe.lng === "number" &&
          !isNaN(cafe.lat) &&
          !isNaN(cafe.lng)
        )
        .map((cafe) => (
          <Marker
            key={cafe.id}
            position={{ lat: cafe.lat, lng: cafe.lng }}
            title={cafe.name}
            onClick={() => onMarkerClick && onMarkerClick(cafe)}
          />
        ))}
    </GoogleMap>
  );
} 