import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  // Animated,
  ImageSourcePropType,
  Modal,
  ScrollView,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/navigationTypes';
import RNFS from 'react-native-fs';
import { getLeaderboard } from '../services/leaderAuthUtils';
import { getImageWithCountry } from '../services/geoApiUtils';
import type { PrefetchedRound } from '../services/geoApiUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// const { width: screenWidth } = Dimensions.get('window');
const backgroundImages: ImageSourcePropType[] = [
  require('../../assets/bg1.jpg'),
  require('../../assets/bg2.jpg'),
  require('../../assets/bg3.jpg'),
  require('../../assets/bg4.jpg'),
  require('../../assets/bg5.jpg'),
  require('../../assets/bg6.jpg'),
  require('../../assets/bg7.jpg'),
  require('../../assets/bg8.jpg'),
  require('../../assets/bg9.jpg'),
  require('../../assets/bg10.jpg'),
  require('../../assets/bg11.jpg'),
];

const MAIN_MENU_STATE_KEY = 'geofinder.mainMenuState.v1';
const MAIN_MENU_STATE_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

type PersistedMainMenuState = {
  prefetchedRound: PrefetchedRound | null;
  currentIndex: number;
  cachedImages: number[];
  savedAt?: number;
};

const MainMenu: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [currentIndex, setCurrentIndex] = useState(0);
  // const slideAnim = useRef(new Animated.Value(0)).current;
  // const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cachedImages, setCachedImages] = useState<number[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [leaderboardData, setLeaderboardData] = useState<
    Array<{
      rank: number;
      score: number;
      createdAt: string;
      gameSessionId: string | null;
    }>
  >([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [showCredits, setShowCredits] = useState<boolean>(false);
  const [prefetchedRound, setPrefetchedRound] =
    useState<PrefetchedRound | null>(null);
  const isPrefetchingRef = useRef(false);
  const prefetchedRoundRef = useRef<PrefetchedRound | null>(null);
  const [userGameSessionIds, setUserGameSessionIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const lastStateRef = useRef<PersistedMainMenuState | null>(null);
  const skipPersistRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const appActiveRef = useRef<boolean>(true);

  const persistMainMenuState = useCallback(async (): Promise<void> => {
    const snapshot = lastStateRef.current;

    if (!snapshot) {
      try {
        await AsyncStorage.removeItem(MAIN_MENU_STATE_KEY);
      } catch (error) {
        console.error('Failed to clear main menu state:', error);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(
        MAIN_MENU_STATE_KEY,
        JSON.stringify({ ...snapshot, savedAt: Date.now() }),
      );
    } catch (error) {
      console.error('Failed to persist main menu state:', error);
    }
  }, []);

  const clearPersistedMainMenuState = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(MAIN_MENU_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear main menu state:', error);
    }
  }, []);

  const restorePersistedMainMenuState =
    useCallback(async (): Promise<boolean> => {
      try {
        const raw = await AsyncStorage.getItem(MAIN_MENU_STATE_KEY);
        if (!raw) return false;

        const parsed = JSON.parse(raw) as PersistedMainMenuState;
        if (!parsed || typeof parsed.savedAt !== 'number') {
          await clearPersistedMainMenuState();
          return false;
        }

        const isExpired =
          Date.now() - parsed.savedAt > MAIN_MENU_STATE_MAX_AGE_MS;
        if (isExpired) {
          await clearPersistedMainMenuState();
          return false;
        }

        if (isMountedRef.current) {
          setPrefetchedRound(parsed.prefetchedRound ?? null);
          prefetchedRoundRef.current = parsed.prefetchedRound ?? null;
          setCachedImages(
            Array.isArray(parsed.cachedImages) ? parsed.cachedImages : [],
          );
          setCurrentIndex(
            Number.isFinite(parsed.currentIndex) ? parsed.currentIndex : 0,
          );
        }
        return true;
      } catch (error) {
        console.error('Failed to restore main menu state:', error);
        return false;
      }
    }, [clearPersistedMainMenuState]);

  const getRandomBackgroundImage = useCallback((cache: number[] = []) => {
    const recentCache = Array.isArray(cache) ? cache : [];

    const availableIndices = backgroundImages
      .map((_, i) => i)
      .filter(i => !recentCache.includes(i));

    if (availableIndices.length === 0) {
      const idx = Math.floor(Math.random() * backgroundImages.length);
      const newCache = [idx].slice(-4);
      setCachedImages(newCache);
      saveCachedImages(newCache);
      return idx;
    }

    const selectedIndex =
      availableIndices[Math.floor(Math.random() * availableIndices.length)];

    const newCache = [...recentCache, selectedIndex].slice(-4);
    setCachedImages(newCache);
    saveCachedImages(newCache);

    return selectedIndex;
  }, []);

  const saveCachedImages = async (newCache: number[]) => {
    try {
      const filePath = `${RNFS.CachesDirectoryPath}/lastUsedImages.json`;
      await RNFS.writeFile(filePath, JSON.stringify(newCache), 'utf8');
    } catch (error) {
      console.error('Error saving cached images:', error);
    }
  };

  const loadCachedImages = useCallback(async () => {
    const filePath = `${RNFS.CachesDirectoryPath}/lastUsedImages.json`;

    try {
      const exists = await RNFS.exists(filePath);

      let cached: number[] = [];
      if (exists) {
        const content = await RNFS.readFile(filePath, 'utf8');
        cached = JSON.parse(content);
        if (isMountedRef.current) {
          setCachedImages(cached);
        }
      } else {
        if (isMountedRef.current) {
          setCachedImages([]);
        }
      }

      const initialIndex = getRandomBackgroundImage(cached);
      if (isMountedRef.current) {
        setCurrentIndex(initialIndex);
      }
    } catch (error) {
      console.error('Error loading cached images:', error);
      const initialIndex = getRandomBackgroundImage([]);
      if (isMountedRef.current) {
        setCurrentIndex(initialIndex);
      }
    }
  }, [getRandomBackgroundImage]);

  // Preload images on component mount
  useEffect(() => {
    const preloadImages = async () => {
      const preloadPromises = backgroundImages.map(imageSource => {
        return Image.prefetch(Image.resolveAssetSource(imageSource).uri);
      });
      await Promise.all(preloadPromises);
      console.log('All background images preloaded');
    };

    preloadImages();
  }, []);

  const prefetchInitialRound = useCallback(async () => {
    if (isPrefetchingRef.current || prefetchedRoundRef.current) {
      return;
    }

    isPrefetchingRef.current = true;
    try {
      const result = await getImageWithCountry();
      if (result) {
        if (!isMountedRef.current) {
          return;
        }
        setPrefetchedRound({
          image: result.image,
          countryInfo: result.countryInfo,
        });
      } else {
        if (!isMountedRef.current) {
          return;
        }
        setPrefetchedRound(null);
      }
    } catch (error) {
      console.error('Error prefetching initial round:', error);
      if (isMountedRef.current) {
        setPrefetchedRound(null);
      }
    }
    isPrefetchingRef.current = false;
  }, []);
  useEffect(() => {
    prefetchedRoundRef.current = prefetchedRound;
  }, [prefetchedRound]);

  useEffect(() => {
    let isCleaningUp = false;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (isCleaningUp) return;

      if (nextState === 'background' || nextState === 'inactive') {
        appActiveRef.current = false;
        if (!skipPersistRef.current && isMountedRef.current) {
          const snapshot = lastStateRef.current;

          if (!snapshot) {
            try {
              await AsyncStorage.removeItem(MAIN_MENU_STATE_KEY);
            } catch (error) {
              console.error('Failed to clear main menu state:', error);
            }
            return;
          }

          try {
            await AsyncStorage.setItem(
              MAIN_MENU_STATE_KEY,
              JSON.stringify({ ...snapshot, savedAt: Date.now() }),
            );
          } catch (error) {
            console.error('Failed to persist main menu state:', error);
          }
        }
      } else if (nextState === 'active') {
        appActiveRef.current = true;
        try {
          await restorePersistedMainMenuState();
        } catch (error) {
          console.error('Failed to restore main menu state:', error);
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      isCleaningUp = true;
      appActiveRef.current = false;
      isMountedRef.current = false;
      subscription.remove();
    };
  }, [restorePersistedMainMenuState]);

  useEffect(() => {
    lastStateRef.current = {
      prefetchedRound,
      currentIndex,
      cachedImages,
    };
  }, [prefetchedRound, currentIndex, cachedImages]);

  useEffect(() => {
    let isMounted = true;
    let prefetchAborted = false;

    const bootstrap = async () => {
      try {
        const restored = await restorePersistedMainMenuState();
        if (!isMounted || prefetchAborted) return;

        await loadCachedImages();
        if (!isMounted || prefetchAborted) return;

        if (!restored) {
          await clearPersistedMainMenuState();
          if (!isMounted || prefetchAborted) return;
          prefetchInitialRound();
        }
      } catch (error) {
        console.error('Error during MainMenu bootstrap:', error);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      prefetchAborted = true;
      isMountedRef.current = false;

      // Only persist state if component is not unmounting due to app backgrounding
      if (!skipPersistRef.current && appActiveRef.current) {
        const snapshot = lastStateRef.current;
        if (snapshot) {
          try {
            AsyncStorage.setItem(
              MAIN_MENU_STATE_KEY,
              JSON.stringify({ ...snapshot, savedAt: Date.now() }),
            ).catch(error =>
              console.error(
                'Failed to persist main menu state on unmount:',
                error,
              ),
            );
          } catch (error) {
            console.error(
              'Failed to persist main menu state on unmount:',
              error,
            );
          }
        }
      } else {
        skipPersistRef.current = false;
      }
    };
  }, [
    clearPersistedMainMenuState,
    loadCachedImages,
    prefetchInitialRound,
    restorePersistedMainMenuState,
  ]);

  const loadUserGameSessionIds = useCallback(async (): Promise<Set<string>> => {
    try {
      const stored = await AsyncStorage.getItem('gameSessionIds');
      if (!stored) {
        return new Set<string>();
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return new Set<string>();
      }

      const normalized = parsed.filter(
        (value: unknown): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      );
      return new Set<string>(normalized);
    } catch (error) {
      console.error('Failed to load cached game session IDs:', error);
      return new Set<string>();
    }
  }, []);

  const handleStartGame = () => {
    const hasRoundReady = prefetchedRound !== null;
    const prefetchWasInFlight = isPrefetchingRef.current;

    navigation.navigate('Game', { prefetchedRound });
    setPrefetchedRound(null);
    prefetchedRoundRef.current = null;

    if (!hasRoundReady) {
      if (!prefetchWasInFlight) {
        prefetchInitialRound();
      }
      return;
    }

    prefetchInitialRound();
  };

  const handleStartAiGame = () => {
    const hasRoundReady = prefetchedRound !== null;
    const prefetchWasInFlight = isPrefetchingRef.current;

    navigation.navigate('AiDuel', { prefetchedRound });
    setPrefetchedRound(null);
    prefetchedRoundRef.current = null;

    if (!hasRoundReady) {
      if (!prefetchWasInFlight) {
        prefetchInitialRound();
      }
      return;
    }

    prefetchInitialRound();
  };

  const handleStartPanoGame = () => {
    navigation.navigate('PanoGame');
  };

  const handleLeaderboard = async () => {
    setShowLeaderboard(true);
    setLoadingLeaderboard(true);
    try {
      const [data, sessionIds] = await Promise.all([
        getLeaderboard(50),
        loadUserGameSessionIds(),
      ]);
      setUserGameSessionIds(new Set<string>(sessionIds));
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Still show the modal but with empty data
      setLeaderboardData([]);
      setUserGameSessionIds(new Set<string>());
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const closeLeaderboard = () => {
    setShowLeaderboard(false);
    setLeaderboardData([]);
    setUserGameSessionIds(new Set<string>());
  };

  const handleCredits = () => {
    setShowCredits(true);
  };

  const closeCredits = () => {
    setShowCredits(false);
  };

  const handleLicences = () => {
    setShowCredits(false);
    navigation.navigate('Licences');
  };

  const handleOpenGithub = async () => {
    const url = 'https://github.com/oof2510/geofinder';
    try {
      await Linking.openURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `Couldn't open GitHub → ${errorMessage}`);
    }
  };

  // const startTransition = () => {
  //   const nextIndex = (currentIndex + 1) % backgroundImages.length;
  //
  //   // Reset animation value and start transition
  //   slideAnim.setValue(0);
  //
  //   Animated.timing(slideAnim, {
  //     toValue: -screenWidth,
  //     duration: 1000, // 1 second transition
  //     useNativeDriver: true,
  //   }).start(({ finished }) => {
  //     if (finished) {
  //       // Update current index after animation completes
  //       setCurrentIndex(nextIndex);
  //       slideAnim.setValue(0);
  //     }
  //   });
  // };

  // useEffect(() => {
  //   // Clear any existing interval
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //   }
  //
  //   // Set up new interval
  //   intervalRef.current = setInterval(() => {
  //     startTransition();
  //   }, 7000); // 7 seconds per image

  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //     }
  //   };
  // }, [currentIndex]); // Only depend on currentIndex

  {
    /* Initialization is now handled after cache load inside loadCachedImages */
  }

  // const nextIndex = (currentIndex + 1) % backgroundImages.length;

  return (
    <SafeAreaView className="flex-1">
      <View className="absolute inset-0 overflow-hidden">
        {/* Current image */}
        {/* <Animated.Image
          key={currentIndex}
          source={backgroundImages[currentIndex]}
          style={{
            transform: [{ translateX: slideAnim }],
          }}
          resizeMode="cover"
        /> */}

        {/* Next image */}
        {/* <Animated.Image
          key={nextIndex}
          source={backgroundImages[nextIndex]}
          style={{
            position: 'absolute',
            transform: [
              {
                translateX: slideAnim.interpolate({
                  inputRange: [-screenWidth, 0],
                  outputRange: [0, screenWidth],
                }),
              },
            ],
          }}
          resizeMode="cover"
        /> */}

        <Image
          source={backgroundImages[currentIndex]}
          className="h-full w-full"
          resizeMode="cover"
        />
      </View>

      <View className="flex-1 items-center justify-center p-5">
        <View className="mb-8 self-center rounded-[14px] px-5 py-3 items-center justify-center">
          {/*<Text>GeoFinder</Text>*/}
          <Image
            source={require('../../assets/logo.png')}
            className="h-64 w-64 opacity-95"
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity
          className="mb-4 w-4/5 items-center justify-center rounded-full bg-[rgba(76,175,80,0.56)] py-3"
          onPress={handleStartGame}
        >
          <Text className="text-lg font-bold text-white">Start Game</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mb-4 w-4/5 items-center justify-center rounded-full bg-[rgba(160,9,247,0.56)] py-3"
          onPress={handleStartAiGame}
        >
          <Text className="text-lg font-bold text-white">Play vs AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mb-4 w-4/5 items-center justify-center rounded-full bg-[rgba(9,211,247,0.56)] py-3"
          onPress={handleStartPanoGame}
        >
          <Text className="text-lg font-bold text-white">360° Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mb-4 w-4/5 items-center justify-center rounded-full bg-[rgba(33,37,243,0.56)] py-3"
          onPress={handleLeaderboard}
        >
          <Text className="text-lg font-bold text-white">Leaderboard</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="absolute bottom-5 left-5 rounded-[15px] border border-[rgba(255,255,255,0.3)] bg-[rgba(0,0,0,0.5)] px-[15px] py-2"
        onPress={handleCredits}
      >
        <Text className="text-xs font-semibold text-[rgba(255,255,255,0.9)]">
          Credits
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="absolute bottom-5 right-5 rounded-[15px] border border-[rgba(255,255,255,0.3)] bg-[rgba(0,0,0,0.5)] px-[15px] py-2"
        onPress={handleOpenGithub}
      >
        <Text className="text-[10px] font-semibold text-[rgba(255,255,255,0.9)]">
          GitHub
        </Text>
      </TouchableOpacity>

      {/* Leaderboard Modal */}
      <Modal
        visible={showLeaderboard}
        transparent={true}
        animationType="slide"
        onRequestClose={closeLeaderboard}
      >
        <View className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.8)]">
          <View className="max-h-[80%] w-[90%] items-center rounded-[10px] bg-[rgba(30,30,30,1)] p-5">
            <Text className="mb-5 text-2xl font-bold text-[rgba(255,215,0,1)]">
              Leaderboard
            </Text>

            {loadingLeaderboard ? (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text className="mt-2.5 text-base text-white">
                  Loading scores...
                </Text>
              </View>
            ) : leaderboardData.length > 0 ? (
              <ScrollView className="max-h-[400px] w-full">
                {leaderboardData.map((entry, index) => {
                  const isUserScore = Boolean(
                    entry.gameSessionId &&
                      userGameSessionIds.has(entry.gameSessionId),
                  );

                  return (
                    <View
                      key={index}
                      className={`mb-2 flex-row items-center justify-between rounded-lg px-[15px] py-3 ${
                        isUserScore
                          ? 'border border-[rgba(76,175,80,0.6)] bg-[rgba(46,125,50,0.2)]'
                          : 'bg-[rgba(42,42,42,1)]'
                      }`}
                    >
                      <Text className="min-w-10 text-base font-bold text-[rgba(76,175,80,1)]">
                        #{entry.rank}
                      </Text>
                      <Text className="flex-1 text-center text-base font-bold text-white">
                        {entry.score} pts
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="min-w-20 text-right text-xs text-[rgba(136,136,136,1)]">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </Text>
                        {isUserScore ? (
                          <View className="ml-2 rounded-md border border-[rgba(76,175,80,0.6)] bg-[rgba(76,175,80,0.25)] px-2 py-[2px]">
                            <Text className="text-xs font-bold text-[rgba(199,234,211,1)]">
                              You
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View className="items-center py-10">
                <Text className="mb-2.5 text-lg text-white">
                  No scores available yet.
                </Text>
                <Text className="text-center text-sm text-[rgba(136,136,136,1)]">
                  Be the first to play and set a high score!
                </Text>
              </View>
            )}

            <View className="mt-5 w-full items-center">
              <TouchableOpacity
                className="w-3/5 items-center justify-center rounded-full bg-[rgba(231,46,46,1)] py-3"
                onPress={closeLeaderboard}
              >
                <Text className="text-base font-bold text-white">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Credits Modal */}
      <Modal
        visible={showCredits}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCredits}
      >
        <View className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.8)]">
          <View className="max-h-[80%] w-[90%] items-center rounded-[10px] bg-[rgba(30,30,30,1)] p-5">
            <Text className="mb-5 text-2xl font-bold text-[rgba(255,215,0,1)]">
              Credits
            </Text>

            <ScrollView className="max-h-[400px] w-full">
              <View className="w-full px-2.5">
                <Text className="text-center text-base leading-6 text-white">
                  Images provided via Mapillary, licensed under CC-BY-SA.
                  {'\n'}
                  Map data provided by OpenStreetMap, licensed under ODbL.
                  {'\n'}
                  Fallback map data provided by BigDataCloud, Open-Metro
                  (CC-BY-4.0), and Geonames (CC-BY-SA)
                  {'\n'}
                  {'\n'}
                  AI models used for AI 1v1 provided by OpenRouter:
                  {'\n'}- Mistral Small 3.1 24B Instruct: licensed under
                  Apache-2.0 (see licenses)
                  {'\n'}- Google Gemma 3 27B: licenced under the Gemma licence
                  (see licences)
                  {'\n'}- Nvidia Nemotron Nano 12B v2 VL: licensed the NVIDIA
                  Open Model Licence (see licenses)
                </Text>
              </View>
            </ScrollView>

            <View className="mt-5 w-full flex-row justify-between px-2.5">
              <TouchableOpacity
                className="w-[48%] items-center justify-center rounded-full bg-[rgba(231,46,46,1)] py-3"
                onPress={closeCredits}
              >
                <Text className="text-base font-bold text-white">Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-[48%] items-center justify-center rounded-full bg-[rgba(231,46,46,1)] py-3"
                onPress={handleLicences}
              >
                <Text className="text-base font-bold text-white">
                  Licences
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MainMenu;
