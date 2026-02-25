import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  BackHandler,
  AppState,
  AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import {
  NavigationProp,
  RootStackParamList,
} from '../navigation/navigationTypes';
import {
  getImageWithCountry,
  normalizeCountry,
  matchGuess,
} from '../services/geoApiUtils';
import type { PrefetchedRound } from '../services/geoApiUtils';
import { startGameSession, submitScore } from '../services/leaderAuthUtils';
import ImageViewer from 'react-native-image-zoom-viewer';
import {
  scheduleSummaryModal,
  cancelSummaryModal,
} from '../utils/summaryTimer';

const TOTAL_ROUNDS = 10;
const GAME_STATE_STORAGE_KEY = 'geofinder.gameState.v1';
const GAME_STATE_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

type PersistedGameState = {
  imageUrl: string | null;
  country: string | null;
  countryCode: string | null;
  displayName: string | null;
  coord: { lat: number; lon: number } | null;
  contributor: string | null;
  guess: string;
  guessCount: number;
  incorrectGuesses: string[];
  feedback: string;
  gameOver: boolean;
  currentScore: number;
  highScore: number;
  nextRound: PrefetchedRound | null;
  roundNumber: number;
  correctAnswers: number;
  completedRounds: number;
  showGameSummary: boolean;
  gameSessionId: string | null;
  submitToLeaderboard: boolean;
  isContinued: boolean;
  savedAt?: number;
};

const GameScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const initialPrefetchedRound: PrefetchedRound | null =
    route.params?.prefetchedRound ?? null;
  const [loading, setLoading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [coord, setCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [contributor, setContributor] = useState<string | null>(null);
  const [guess, setGuess] = useState<string>('');
  const [guessCount, setGuessCount] = useState<number>(0);
  const [incorrectGuesses, setIncorrectGuesses] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [zoomImage, setZoomImage] = useState<boolean>(false);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [nextRound, setNextRound] = useState<PrefetchedRound | null>(
    initialPrefetchedRound,
  );
  const prefetchIdRef = useRef<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [completedRounds, setCompletedRounds] = useState<number>(0);
  const [showGameSummary, setShowGameSummary] = useState<boolean>(false);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef<boolean>(false);
  const [submitToLeaderboard, setSubmitToLeaderboard] = useState<boolean>(true);
  const [isContinued, setIsContinued] = useState<boolean>(false);
  const lastStateRef = useRef<PersistedGameState | null>(null);

  const clearSummaryTimeout = (): void => {
    cancelSummaryModal(summaryTimeoutRef);
  };

  const prefetchNextRound = async (): Promise<void> => {
    const requestId: number = ++prefetchIdRef.current;
    try {
      const result = await getImageWithCountry();
      if (!result) return;

      if (prefetchIdRef.current === requestId) {
        setNextRound(result);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startGame = async (): Promise<void> => {
    clearSummaryTimeout();
    setShowGameSummary(false);
    if (completedRounds >= TOTAL_ROUNDS) {
      setCompletedRounds(0);
      setRoundNumber(1);
    }

    const hasPrefetched: boolean = nextRound !== null;
    if (!hasPrefetched) {
      setLoading(true);
    }
    setImageUrl(null);
    setCountry(null);
    setCountryCode(null);
    setDisplayName(null);
    setCoord(null);
    setContributor(null);
    setGuess('');
    setGuessCount(0);
    setIncorrectGuesses([]);
    setFeedback('');
    setGameOver(false);

    try {
      let roundData: PrefetchedRound | null = nextRound;
      if (roundData) {
        setNextRound(null);
      } else {
        const result = await getImageWithCountry();
        if (!result) {
          Alert.alert('Error', 'Could not fetch an image. Try again.');
          return;
        }
        roundData = result;
      }

      if (!roundData) {
        Alert.alert('Error', 'Could not fetch an image. Try again.');
        return;
      }

      setImageUrl(roundData.image.url);
      setCoord(roundData.image.coord);
      setContributor(roundData.image.contributor ?? null);

      if (roundData.countryInfo) {
        setCountry(roundData.countryInfo.country);
        setCountryCode(roundData.countryInfo.countryCode);
        setDisplayName(roundData.countryInfo.displayName);
      } else {
        setDisplayName('Unknown');
      }

      prefetchNextRound();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to start game.');
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = (): void => {
    if (!guess.trim()) return;

    const normalizedGuess: string = normalizeCountry(guess);
    const isCorrect: boolean = matchGuess(
      normalizedGuess,
      country,
      countryCode,
    );
    const newGuessCount: number = guessCount + 1;
    setGuessCount(newGuessCount);

    if (isCorrect) {
      setFeedback(`✅ Correct! It was ${displayName}`);
      setGameOver(true);
      setCorrectAnswers(prev => prev + 1);

      let pointsEarned: number;
      if (newGuessCount === 1) {
        pointsEarned = 3;
      } else if (newGuessCount === 2) {
        pointsEarned = 2;
      } else if (newGuessCount === 3) {
        pointsEarned = 1;
      } else {
        pointsEarned = 0;
      }

      const newScore = currentScore + pointsEarned;
      setCurrentScore(newScore);

      if (newScore > highScore) {
        setHighScore(newScore);
        AsyncStorage.setItem('highScore', newScore.toString());
      }
    } else {
      const newIncorrect: string[] = [...incorrectGuesses, guess];
      setIncorrectGuesses(newIncorrect);
      if (newGuessCount >= 3) {
        const coordStr: string = coord
          ? `(${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)})`
          : '';
        setFeedback(
          `❌ Game over! It was ${displayName}${
            coordStr ? ' ' + coordStr : ''
          }`,
        );
        if (isContinued) {
          const newScore = currentScore - 1;
          setCurrentScore(newScore);
        }
        setGameOver(true);
      } else {
        setFeedback(`❌ Not quite. Try again! (Guess ${newGuessCount}/3)`);
      }
    }
    setGuess('');

    // Check if round is complete
    if (isCorrect || newGuessCount >= 3) {
      setCompletedRounds(prevCompleted => {
        const updatedCompleted = prevCompleted + 1;

        if (updatedCompleted >= TOTAL_ROUNDS) {
          scheduleSummaryModal(summaryTimeoutRef, setShowGameSummary);
        } else {
          setRoundNumber(prev => prev + 1);
        }

        return updatedCompleted;
      });
    }
  };

  const continueGame = (): void => {
    clearSummaryTimeout();
    setRoundNumber(1);
    setCompletedRounds(0);
    setShowGameSummary(false);
    setIsContinued(true);
    startGame();
  };

  const persistGameState = useCallback(async (): Promise<void> => {
    const snapshot = lastStateRef.current;

    if (!snapshot || !snapshot.imageUrl) {
      try {
        await AsyncStorage.removeItem(GAME_STATE_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear saved game state:', error);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(
        GAME_STATE_STORAGE_KEY,
        JSON.stringify({ ...snapshot, savedAt: Date.now() }),
      );
    } catch (error) {
      console.error('Failed to persist game state:', error);
    }
  }, []);

  const clearPersistedGameState = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(GAME_STATE_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear saved game state:', error);
    }
  }, []);

  const restorePersistedGameState = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(GAME_STATE_STORAGE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw) as PersistedGameState;

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.imageUrl ||
        typeof parsed.savedAt !== 'number'
      ) {
        await clearPersistedGameState();
        return false;
      }

      const isExpired = Date.now() - parsed.savedAt > GAME_STATE_MAX_AGE_MS;
      if (isExpired) {
        await clearPersistedGameState();
        return false;
      }

      setImageUrl(typeof parsed.imageUrl === 'string' ? parsed.imageUrl : null);
      setCoord(
        parsed.coord &&
          typeof parsed.coord.lat === 'number' &&
          typeof parsed.coord.lon === 'number'
          ? { lat: parsed.coord.lat, lon: parsed.coord.lon }
          : null,
      );
      setContributor(
        typeof parsed.contributor === 'string' ? parsed.contributor : null,
      );
      setCountry(typeof parsed.country === 'string' ? parsed.country : null);
      setCountryCode(
        typeof parsed.countryCode === 'string' ? parsed.countryCode : null,
      );
      setDisplayName(
        typeof parsed.displayName === 'string' ? parsed.displayName : null,
      );
      setGuess(typeof parsed.guess === 'string' ? parsed.guess : '');
      setGuessCount(Number.isFinite(parsed.guessCount) ? parsed.guessCount : 0);
      setIncorrectGuesses(
        Array.isArray(parsed.incorrectGuesses)
          ? parsed.incorrectGuesses.filter(
              (g: unknown): g is string => typeof g === 'string',
            )
          : [],
      );
      setFeedback(typeof parsed.feedback === 'string' ? parsed.feedback : '');
      setGameOver(Boolean(parsed.gameOver));
      setCurrentScore(
        Number.isFinite(parsed.currentScore) ? parsed.currentScore : 0,
      );
      setHighScore(
        Number.isFinite(parsed.highScore) ? parsed.highScore : highScore,
      );
      setRoundNumber(
        Number.isFinite(parsed.roundNumber) ? parsed.roundNumber : 1,
      );
      setCorrectAnswers(
        Number.isFinite(parsed.correctAnswers) ? parsed.correctAnswers : 0,
      );
      setCompletedRounds(
        Number.isFinite(parsed.completedRounds) ? parsed.completedRounds : 0,
      );
      setShowGameSummary(Boolean(parsed.showGameSummary));
      setGameSessionId(
        typeof parsed.gameSessionId === 'string' ? parsed.gameSessionId : null,
      );
      setSubmitToLeaderboard(
        typeof parsed.submitToLeaderboard === 'boolean'
          ? parsed.submitToLeaderboard
          : true,
      );
      setIsContinued(Boolean(parsed.isContinued));
      setNextRound(parsed.nextRound ?? null);
      setLoading(false);

      return true;
    } catch (error) {
      console.error('Failed to restore saved game state:', error);
      return false;
    }
  }, [clearPersistedGameState, highScore]);

  const storeGameSessionId = async (id: string): Promise<void> => {
    try {
      const existing = await AsyncStorage.getItem('gameSessionIds');
      const parsed: string[] = existing ? JSON.parse(existing) : [];
      // Avoid duplicates while keeping this id as the most recent
      if (!parsed.includes(id)) {
        parsed.push(id);
      }
      await AsyncStorage.setItem('gameSessionIds', JSON.stringify(parsed));
    } catch (error) {
      console.error('Failed to cache game session id:', error);
    }
  };

  const initializeGameSession = async (): Promise<void> => {
    setLoading(true);
    try {
      const session = await startGameSession();
      setGameSessionId(session.gameSessionId);
      await storeGameSessionId(session.gameSessionId);
      console.log('Game session started:', session.gameSessionId);
      await startGame();
    } catch (error) {
      console.error('Error starting game session:', error);
      Alert.alert(
        'Warning',
        'Could not start game session. Playing in offline mode.',
      );
      await startGame();
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToMainMenu = async (): Promise<void> => {
    skipPersistRef.current = true;
    if (submitToLeaderboard && gameSessionId && currentScore > 0) {
      try {
        await submitScore(gameSessionId, currentScore, {
          correctAnswers,
          totalRounds: TOTAL_ROUNDS,
          roundsPlayed: completedRounds,
        });
        console.log('Score submitted successfully');
      } catch (error) {
        console.error('Error submitting score:', error);
        Alert.alert('Warning', 'Could not submit score to leaderboard.');
      }
    } else if (!submitToLeaderboard && currentScore > 0) {
      console.log('Skipping leaderboard submission per user choice');
    }
    await clearPersistedGameState();
    clearSummaryTimeout();
    setShowGameSummary(false);
    navigation.navigate('MainMenu');
  };

  useEffect(() => {
    lastStateRef.current = {
      imageUrl,
      country,
      countryCode,
      displayName,
      coord,
      contributor,
      guess,
      guessCount,
      incorrectGuesses,
      feedback,
      gameOver,
      currentScore,
      highScore,
      nextRound,
      roundNumber,
      correctAnswers,
      completedRounds,
      showGameSummary,
      gameSessionId,
      submitToLeaderboard,
      isContinued,
    };
  }, [
    imageUrl,
    country,
    countryCode,
    displayName,
    coord,
    contributor,
    guess,
    guessCount,
    incorrectGuesses,
    feedback,
    gameOver,
    currentScore,
    highScore,
    nextRound,
    roundNumber,
    correctAnswers,
    completedRounds,
    showGameSummary,
    gameSessionId,
    submitToLeaderboard,
    isContinued,
  ]);

  useEffect(() => {
    const backAction = () => {
      if (zoomImage) {
        setZoomImage(false);
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, [zoomImage]);

  useEffect(() => {
    const loadHighScore = async () => {
      try {
        const stored = await AsyncStorage.getItem('highScore');
        if (stored) {
          setHighScore(parseInt(stored, 10)); // force base 10
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadHighScore();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        clearSummaryTimeout();
        if (!skipPersistRef.current) {
          persistGameState();
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [persistGameState]);

  useEffect(() => {
    let isMounted = true;
    let prefetchAborted = false;

    const bootstrap = async () => {
      try {
        const restored = await restorePersistedGameState();
        if (!isMounted || prefetchAborted) return;

        if (restored) {
          setLoading(false);
          prefetchNextRound();
          return;
        }

        await clearPersistedGameState();
        if (!isMounted || prefetchAborted) return;
        initializeGameSession();
      } catch (error) {
        console.error('Error during GameScreen bootstrap:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      prefetchAborted = true;
      clearSummaryTimeout();
      if (!skipPersistRef.current) {
        persistGameState();
      } else {
        skipPersistRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-[#121212]">
      <SafeAreaView className="flex-1 bg-[#121212]">
        <ScrollView
          contentContainerClassName="items-center p-5"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-5 mt-5 text-3xl font-bold text-white">
            GeoFinder
          </Text>
          <Text className="mb-2.5 text-white">
            Round {roundNumber}/{TOTAL_ROUNDS}
          </Text>
          {loading && <Text className="text-white">Loading...</Text>}
          {imageUrl && (
            <TouchableOpacity
              className="mb-5 w-full items-center"
              onPress={() => setZoomImage(true)}
            >
              <Image
                source={{ uri: imageUrl ?? undefined }}
                className="h-[200px] w-full rounded-lg"
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          {!gameOver && imageUrl && (
            <>
              <Text className="mb-2.5 text-lg text-white">
                Guess the country! (Guess {guessCount + 1}/3)
              </Text>
              <TextInput
                className="mb-4 h-[50px] w-4/5 rounded-lg border border-[#444] bg-[#1E1E1E] px-4 text-base text-white"
                value={guess}
                onChangeText={setGuess}
                onSubmitEditing={submitGuess}
                placeholder="Enter country name"
                placeholderTextColor="#888"
              />
              <TouchableOpacity
                className="mb-4 w-4/5 items-center justify-center rounded-full bg-[#4CAF50] py-3"
                onPress={submitGuess}
              >
                <Text className="text-center text-base font-bold text-white">
                  Submit Guess
                </Text>
              </TouchableOpacity>
            </>
          )}
          {feedback && (
            <Text
              className={`my-4 text-center text-base ${
                feedback.includes('✅') ? 'text-[#4CAF50]' : 'text-[#FF6B6B]'
              }`}
            >
              {feedback}
            </Text>
          )}
          {incorrectGuesses.length > 0 && (
            <View className="w-4/5">
              <Text className="mt-2.5 text-base font-bold text-white">
                Previous Guesses:
              </Text>
              {incorrectGuesses.map((g: string, i: number) => (
                <Text key={i} className="text-sm text-[#FF6B6B]">
                  • {g}
                </Text>
              ))}
            </View>
          )}
          {gameOver && completedRounds < TOTAL_ROUNDS && !showGameSummary && (
            <TouchableOpacity
              className="mb-4 w-4/5 items-center justify-center rounded-full bg-[#2196F3] py-3"
              onPress={startGame}
            >
              <Text className="text-center text-base font-bold text-white">
                Next Game
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <Text className="absolute bottom-[70px] left-5 right-5 text-center text-xs text-[#888888]">
          {contributor
            ? `Image by ${contributor} at Mapillary, CC-BY-SA`
            : 'Images provided via Mapillary'}
        </Text>
        <View className="absolute bottom-5 left-5 right-5 flex-row justify-between">
          <Text className="text-base text-white">High Score: {highScore}</Text>
          <Text className="text-base text-white">Score: {currentScore}</Text>
        </View>

        <Modal
          visible={zoomImage}
          transparent={true}
          onRequestClose={() => setZoomImage(false)}
        >
          <ImageViewer
            imageUrls={[{ url: imageUrl ?? '' }]}
            onCancel={() => setZoomImage(false)}
            enableSwipeDown={true}
            onSwipeDown={() => setZoomImage(false)}
            saveToLocalByLongPress={false}
          />
        </Modal>

        {/* Game Summary Modal */}
        <Modal
          visible={showGameSummary}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.8)]">
            <View className="w-4/5 items-center rounded-[10px] bg-[#1E1E1E] p-5">
              <Text className="mb-5 text-2xl font-bold text-white">
                Game Complete!
              </Text>
              <Text className="mb-2.5 text-center text-lg text-white">
                You got {correctAnswers} out of {TOTAL_ROUNDS} correct!
              </Text>
              <Text className="mb-2.5 text-center text-lg text-white">
                Final Score: {currentScore}
              </Text>
              {currentScore > highScore && (
                <Text className="mb-5 text-lg font-bold text-[#66ff00af]">
                  New High Score! 🎉
                </Text>
              )}
              <View className="mt-2.5 w-full items-center">
                <TouchableOpacity
                  className={`mb-2.5 rounded-2xl px-4 py-2 ${
                    submitToLeaderboard ? 'bg-[#4CAF50]' : 'bg-[#9E9E9E]'
                  }`}
                  onPress={() => setSubmitToLeaderboard(prev => !prev)}
                >
                  <Text className="text-sm text-white">
                    {submitToLeaderboard
                      ? 'Leaderboard: ON'
                      : 'Leaderboard: OFF'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="mb-4 w-4/5 items-center justify-center rounded-full bg-[#4CAF50] py-3"
                  onPress={continueGame}
                >
                  <Text className="text-center text-base font-bold text-white">
                    Continue Game
                    {'\n'}
                    (Lose points if you guess wrong)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="mb-4 w-4/5 items-center justify-center rounded-full bg-[#2196F3] py-3"
                  onPress={async () => {
                    if (
                      submitToLeaderboard &&
                      gameSessionId &&
                      currentScore > 0
                    ) {
                      try {
                        await submitScore(gameSessionId, currentScore, {
                          correctAnswers,
                          totalRounds: TOTAL_ROUNDS,
                          roundsPlayed: completedRounds,
                        });
                        // Reset score and start fresh
                        setCurrentScore(0);
                        setCorrectAnswers(0);
                        setCompletedRounds(0);
                        setRoundNumber(1);
                        Alert.alert(
                          'Success',
                          'Score submitted to leaderboard! Starting fresh game...',
                        );
                        setIsContinued(false);
                        initializeGameSession();
                      } catch (error) {
                        console.error('Error submitting score:', error);
                        Alert.alert(
                          'Error',
                          'Could not submit score to leaderboard.',
                        );
                      }
                    } else {
                      if (!submitToLeaderboard && currentScore > 0) {
                        console.log(
                          'Starting new game without submitting score per user choice',
                        );
                      }
                      setCurrentScore(0);
                      setCorrectAnswers(0);
                      setCompletedRounds(0);
                      setRoundNumber(1);
                      setIsContinued(false);
                      initializeGameSession();
                    }
                  }}
                >
                  <Text className="text-center text-base font-bold text-white">
                    New Game
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="mb-4 w-4/5 items-center justify-center rounded-full bg-[#F44336] py-3"
                  onPress={handleReturnToMainMenu}
                >
                  <Text className="text-center text-base font-bold text-white">
                    Return to Main Menu
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

export default GameScreen;
