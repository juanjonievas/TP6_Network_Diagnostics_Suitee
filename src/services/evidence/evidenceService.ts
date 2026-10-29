import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export interface LocationResult {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

export class EvidenceService {
  /**
   * Requests runtime GPS permissions on Android
   */
  static async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permiso de Ubicación Satelital',
            message: 'La aplicación requiere coordenadas GPS reales para georreferenciar la instalación de campo.',
            buttonNeutral: 'Recordar luego',
            buttonNegative: 'Denegar',
            buttonPositive: 'Permitir',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('[EvidenceService] Error solicitando permisos de GPS:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Retrieves high-accuracy GPS coordinates from hardware sensor
   */
  static async getCurrentLocation(timeoutMs = 12000): Promise<LocationResult> {
    // In test environment, Geolocation is mocked in __tests__/setup.ts
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission && Platform.OS === 'android') {
      throw new Error('Permisos de ubicación satelital denegados por el usuario');
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || null,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          let msg = 'Error obteniendo posición GPS';
          if (error.code === 1) msg = 'Permiso de ubicación denegado';
          else if (error.code === 2) msg = 'Sensor GPS desactivado en el dispositivo';
          else if (error.code === 3) msg = 'Tiempo de espera de señal GPS agotado';
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 5000,
        }
      );
    });
  }

  /**
   * Converts a raw buffer or dummy image into Base64 format for self-contained PDF embedding
   */
  static bufferToBase64Image(buffer: Buffer, mimeType = 'image/jpeg'): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Generates a sample telecom rack photo in Base64 for offline testing
   */
  static getSampleRackPhotoBase64(): string {
    // A minimal valid 1x1 JPEG Base64
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  }
}
