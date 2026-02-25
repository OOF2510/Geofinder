import appCheck from '@react-native-firebase/app-check';
import { decode } from 'base-64';
import { initializeFirebase } from './firebase';
import GeoApi from '@oof2510/geoapi';

const API_BASE_URL = 'https://geo.api.oof2510.space';

export const geoApiClient = new GeoApi(API_BASE_URL);

let appCheckToken = '';
let appCheckTokenExpiry = 0;
let firebaseInitialized = false;

// Helper function to parse JWT and get expiry time
const getTokenExpiry = (token: string): number => {
  try {
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(
      decode(payload.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return decodedPayload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return Date.now() + 3600000; // Fallback to 1 hour from now
  }
};

// Initialize Firebase App Check
export const initAppCheck = async () => {
  if (!firebaseInitialized) {
    try {
      initializeFirebase();
      firebaseInitialized = true;
    } catch (error) {
      console.error('Error initializing Firebase App Check provider:', error);
    }
  }

  try {
    const appCheckTokenResult = await appCheck().getToken(true);
    if (appCheckTokenResult) {
      appCheckToken = appCheckTokenResult.token;
      // Parse expiry from JWT token
      appCheckTokenExpiry = getTokenExpiry(appCheckToken);
      geoApiClient.setAppCheckToken(appCheckToken);
    }
  } catch (error) {
    console.error('Error initializing App Check:', error);
  }
};

// Get a valid App Check token
const getValidToken = async (): Promise<string> => {
  if (!appCheckToken || Date.now() >= appCheckTokenExpiry) {
    await initAppCheck();
  }
  if (appCheckToken) {
    geoApiClient.setAppCheckToken(appCheckToken);
  }
  return appCheckToken;
};

// Game session management
export const startGameSession = async (): Promise<{
  gameSessionId: string;
  seed: string;
  expiresAt: string;
}> => {
  const token = await getValidToken();
  geoApiClient.setAppCheckToken(token || null);
  return geoApiClient.startGame();
};

export const submitScore = async (
  gameSessionId: string,
  score: number,
  metadata: Record<string, any> = {},
): Promise<void> => {
  const token = await getValidToken();
  geoApiClient.setAppCheckToken(token || null);
  await geoApiClient.submitScore(gameSessionId, score, metadata);
};

export const getLeaderboard = async (
  limit: number = 50,
): Promise<
  Array<{
    rank: number;
    score: number;
    createdAt: string;
    gameSessionId: string | null;
  }>
> => {
  return geoApiClient.getLeaderboard(limit);
};

export const getAppCheckToken = getValidToken;
