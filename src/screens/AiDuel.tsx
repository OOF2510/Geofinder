import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  BackHandler,
  Modal,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import ImageViewer from 'react-native-image-zoom-viewer';
import type { PrefetchedRound } from '../services/geoApiUtils';
import { normalizeCountry } from '../services/geoApiUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AiDuelApiError,
  AiDuelGuessResponse,
  AiDuelHistoryEntry,
  AiDuelRound,
  AiDuelScores,
  AiDuelStatus,
  startAiMatch,
  submitAiGuess,
} from '../services/aiDuelUtils';
import {
  NavigationProp,
  RootStackParamList,
} from '../navigation/navigationTypes';

const formatCountry = (value?: string | null): string => {
  if (!value) return 'Unknown';
  const normalized = normalizeCountry(value);
  if (!normalized) return value;
  return value
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatConfidence = (confidence?: number | null): string => {
  if (typeof confidence !== 'number') return '--';
  return `${Math.round(confidence * 100)}%`;
};

const formatCoordinates = (
  coords?: { lat?: number; lon?: number } | null,
): string | null => {
  if (
    !coords ||
    typeof coords.lat !== 'number' ||
    typeof coords.lon !== 'number'
  ) {
    return null;
  }
  return `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
};

const DEFAULT_SCORES: AiDuelScores = { player: 0, ai: 0 };
const STATE_STORAGE_KEY = 'geofinder.aiDuelState.v1';
const STATE_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

type PersistedAiDuelState = {
  matchId: string | null;
  currentRound: AiDuelRound | null;
  queuedRound: AiDuelRound | null;
  totalRounds: number;
  scores: AiDuelScores;
  status: AiDuelStatus;
  guess: string;
  latestResult: AiDuelGuessResponse | null;
  history: AiDuelHistoryEntry[];
  prefetchedImageUrl: string | null;
  prefetchedRoundUrl: string | null;
  errorMessage: string;
  savedAt?: number;
};

const AiDuel: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AiDuel'>>();
  const initialPrefetchedRound: PrefetchedRound | null =
    route.params?.prefetchedRound ?? null;
  const prefetchedRoundUrl: string | null =
    initialPrefetchedRound?.image.url ?? null;

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<AiDuelRound | null>(null);
  const [queuedRound, setQueuedRound] = useState<AiDuelRound | null>(null);
  const [totalRounds, setTotalRounds] = useState<number>(0);
  const [scores, setScores] = useState<AiDuelScores>({ ...DEFAULT_SCORES });
  const [status, setStatus] = useState<AiDuelStatus>('in-progress');
  const [guess, setGuess] = useState<string>('');
  const [latestResult, setLatestResult] = useState<AiDuelGuessResponse | null>(
    null,
  );
  const [history, setHistory] = useState<AiDuelHistoryEntry[]>([]);
  const [zoomImage, setZoomImage] = useState<boolean>(false);
  const [prefetchedImageUrl, setPrefetchedImageUrl] = useState<string | null>(
    prefetchedRoundUrl,
  );
  const lastStateRef = useRef<PersistedAiDuelState | null>(null);

  useEffect(() => {
    setPrefetchedImageUrl(prefetchedRoundUrl);
  }, [prefetchedRoundUrl]);

  const resetState = useCallback((): void => {
    setGuess('');
    setScores({ ...DEFAULT_SCORES });
    setQueuedRound(null);
    setLatestResult(null);
    setHistory([]);
    setStatus('in-progress');
    setErrorMessage('');
    setCurrentRound(null);
    setMatchId(null);
  }, []);

  useEffect(() => {
    lastStateRef.current = {
      matchId,
      currentRound,
      queuedRound,
      totalRounds,
      scores,
      status,
      guess,
      latestResult,
      history,
      prefetchedImageUrl,
      prefetchedRoundUrl,
      errorMessage,
    };
  }, [
    currentRound,
    errorMessage,
    guess,
    history,
    latestResult,
    matchId,
    prefetchedImageUrl,
    prefetchedRoundUrl,
    queuedRound,
    scores,
    status,
    totalRounds,
  ]);

  const persistAiDuelState = useCallback(async (): Promise<void> => {
    const snapshot = lastStateRef.current;

    if (
      !snapshot ||
      (!snapshot.matchId &&
        !snapshot.prefetchedImageUrl &&
        !snapshot.currentRound)
    ) {
      try {
        await AsyncStorage.removeItem(STATE_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear saved AI duel state:', error);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(
        STATE_STORAGE_KEY,
        JSON.stringify({ ...snapshot, savedAt: Date.now() }),
      );
    } catch (error) {
      console.error('Failed to persist AI duel state:', error);
    }
  }, []);

  const clearPersistedAiDuelState = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STATE_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear saved AI duel state:', error);
    }
  }, []);

  const restorePersistedAiDuelState =
    useCallback(async (): Promise<boolean> => {
      try {
        const raw = await AsyncStorage.getItem(STATE_STORAGE_KEY);
        if (!raw) return false;

        const parsed = JSON.parse(raw) as PersistedAiDuelState;
        if (!parsed || typeof parsed.savedAt !== 'number') {
          await clearPersistedAiDuelState();
          return false;
        }

        const isExpired = Date.now() - parsed.savedAt > STATE_MAX_AGE_MS;
        if (isExpired) {
          await clearPersistedAiDuelState();
          return false;
        }

        setMatchId(typeof parsed.matchId === 'string' ? parsed.matchId : null);
        setCurrentRound(parsed.currentRound ?? null);
        setQueuedRound(parsed.queuedRound ?? null);
        setTotalRounds(
          Number.isFinite(parsed.totalRounds) ? parsed.totalRounds : 0,
        );
        setScores(parsed.scores ?? { ...DEFAULT_SCORES });
        setStatus(parsed.status ?? 'in-progress');
        setGuess(typeof parsed.guess === 'string' ? parsed.guess : '');
        setLatestResult(parsed.latestResult ?? null);
        setHistory(Array.isArray(parsed.history) ? parsed.history : []);
        setPrefetchedImageUrl(
          typeof parsed.prefetchedImageUrl === 'string'
            ? parsed.prefetchedImageUrl
            : parsed.prefetchedRoundUrl ?? null,
        );
        setErrorMessage(
          typeof parsed.errorMessage === 'string' ? parsed.errorMessage : '',
        );
        setLoading(false);
        setSubmitting(false);
        setZoomImage(false);
        return Boolean(parsed.matchId || parsed.currentRound);
      } catch (error) {
        console.error('Failed to restore AI duel state:', error);
        return false;
      }
    }, [clearPersistedAiDuelState]);

  const bootstrap = useCallback(async (): Promise<void> => {
    setLoading(true);
    await clearPersistedAiDuelState();
    resetState();
    try {
      const response = await startAiMatch();
      if (!response?.matchId || !response.round) {
        throw new Error('Match could not be created');
      }

      setMatchId(response.matchId);
      setCurrentRound(response.round);
      setTotalRounds(response.totalRounds ?? 0);
      setScores(
        response.scores ? { ...response.scores } : { ...DEFAULT_SCORES },
      );
      setStatus(response.status ?? 'in-progress');
      setPrefetchedImageUrl(null);
    } catch (error) {
      console.error('Failed to start AI duel', error);
      setErrorMessage(
        "Couldn't start a match right now. Double-check your network connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [clearPersistedAiDuelState, resetState]);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      const restored = await restorePersistedAiDuelState();
      if (!isMounted) return;

      if (!restored) {
        await bootstrap();
      } else {
        setLoading(false);
        setSubmitting(false);
      }
    };

    hydrate();

    return () => {
      isMounted = false;
      persistAiDuelState();
    };
  }, [bootstrap, persistAiDuelState, restorePersistedAiDuelState]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const snapshot = lastStateRef?.current;
        if (snapshot) {
          try {
            AsyncStorage.setItem(
              STATE_STORAGE_KEY,
              JSON.stringify({ ...snapshot, savedAt: Date.now() }),
            ).catch(error =>
              console.error('Failed to persist AI duel state:', error),
            );
          } catch (error) {
            console.error('Failed to persist AI duel state:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const backAction = (): boolean => {
      if (zoomImage) {
        setZoomImage(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [zoomImage]);

  const roundLabel = useMemo(() => {
    if (!currentRound) return '';
    const roundNumber = currentRound.roundIndex + 1;
    return totalRounds
      ? `Round ${roundNumber} / ${totalRounds}`
      : `Round ${roundNumber}`;
  }, [currentRound, totalRounds]);

  const displayedImageUrl = currentRound?.imageUrl ?? prefetchedImageUrl;
  const displayedContributor =
    currentRound?.contributor ??
    latestResult?.contributor ??
    initialPrefetchedRound?.image.contributor ??
    null;
  const canSubmitGuess =
    !loading && !submitting && status === 'in-progress' && currentRound;
  const guessReady = guess.trim().length > 0;
  const completed = status === 'completed';
  const awaitingNextRound =
    status === 'in-progress' && Boolean(latestResult && queuedRound);

  const coordinateText = formatCoordinates(latestResult?.coordinates);

  const handleSubmitGuess = useCallback(async (): Promise<void> => {
    if (!canSubmitGuess) return;
    if (!matchId || !currentRound) {
      setErrorMessage('Match not ready yet. Please wait a moment.');
      return;
    }

    const cleanedGuess = guess.trim();
    if (!cleanedGuess) {
      setErrorMessage('Enter a country before submitting your guess.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await submitAiGuess(
        matchId,
        currentRound.roundIndex,
        cleanedGuess,
      );
      setLatestResult(response);
      if (response.scores) {
        setScores({ ...response.scores });
      }
      if (response.status) {
        setStatus(response.status);
      }
      if (response.history) {
        setHistory(response.history);
      }
      setQueuedRound(response.nextRound ?? null);
      setGuess('');
    } catch (error) {
      console.error('Failed to submit AI guess', error);
      const duelError = error as AiDuelApiError;
      const payload =
        (duelError && typeof duelError === 'object'
          ? (duelError.payload as Record<string, unknown> | undefined)
          : undefined) ?? undefined;

      if (duelError.code === 'round_out_of_sync') {
        const expectedRound = payload?.expectedRound as AiDuelRound | undefined;
        const nextHistory = payload?.history as
          | AiDuelHistoryEntry[]
          | undefined;
        const nextScores = payload?.scores as AiDuelScores | undefined;
        const nextStatus = payload?.status as AiDuelStatus | undefined;

        if (expectedRound) {
          setCurrentRound(expectedRound);
        }
        if (Array.isArray(nextHistory)) {
          setHistory(nextHistory);
        }
        if (nextScores) {
          setScores({ ...nextScores });
        }
        if (nextStatus) {
          setStatus(nextStatus);
        }

        setQueuedRound(null);
        setLatestResult(null);
        setGuess('');
        setErrorMessage(
          'The match messed up and got behind. Try guessing again!',
        );
      } else if (duelError.code === 'match_completed') {
        const nextScores = payload?.scores as AiDuelScores | undefined;
        const nextHistory = payload?.history as
          | AiDuelHistoryEntry[]
          | undefined;
        if (nextScores) {
          setScores({ ...nextScores });
        }
        if (Array.isArray(nextHistory)) {
          setHistory(nextHistory);
        }
        setStatus('completed');
        setLatestResult(null);
        setQueuedRound(null);
        setErrorMessage('This match already wrapped up. Start a new duel!');
      } else if (duelError.code === 'missing_app_check_token') {
        setErrorMessage(
          'App Check verification failed. Please try again or restart the app.',
        );
      } else {
        setErrorMessage(
          duelError.message ||
            'Something went wrong submitting your guess. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmitGuess, currentRound, guess, matchId]);

  const handleNextRound = useCallback((): void => {
    if (!queuedRound) return;
    setCurrentRound(queuedRound);
    setQueuedRound(null);
    setLatestResult(null);
    setGuess('');
    setErrorMessage('');
  }, [queuedRound]);

  const handleRematch = useCallback((): void => {
    clearPersistedAiDuelState();
    bootstrap();
  }, [bootstrap, clearPersistedAiDuelState]);

  const handleReturnToMenu = useCallback((): void => {
    clearPersistedAiDuelState();
    navigation.navigate('MainMenu');
  }, [clearPersistedAiDuelState, navigation]);

  return (
    <View className="flex-1 bg-[#121212]">
      <SafeAreaView className="flex-1 bg-[#121212]">
        <ScrollView
          contentContainerClassName="p-5 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-3 text-3xl font-bold text-white">
            GeoFinder AI Duel
          </Text>
          <Text className="mb-4 text-sm leading-5 text-[#CCCCCC]">
            Challenge GeoFinder&apos;s AI opponent across a multi-round match.
            Guess the country, compare results, and see how the AI reasoned
            about the image.
          </Text>

          <View className="mb-5 flex-row flex-wrap">
            <TouchableOpacity
              className="mb-3 mr-3 rounded-3xl border border-[#444] bg-[#1E1E1E] px-[18px] py-2.5"
              onPress={handleReturnToMenu}
            >
              <Text className="text-center text-sm font-bold text-white">
                Back to Main Menu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`mb-3 mr-3 rounded-3xl bg-[#2196F3] px-[18px] py-2.5 ${
                loading ? 'opacity-60' : ''
              }`}
              onPress={handleRematch}
              disabled={loading}
            >
              <Text className="text-center text-sm font-bold text-white">
                {loading
                  ? 'Starting match...'
                  : completed
                  ? 'Start new match'
                  : 'Restart'}
              </Text>
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View className="mb-4 rounded-xl border border-[#D32F2F] bg-[#3D1F1F] p-3">
              <Text className="text-sm text-[#FFB4A4]">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="mb-5 rounded-2xl border border-[#2A2A2A] bg-[#1E1E1E] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-white">
                {roundLabel || 'Awaiting round'}
              </Text>
              <View className="flex-row items-center rounded-[20px] bg-[#252525] px-3 py-1.5">
                <Text className="text-sm font-semibold text-white">
                  You {scores.player ?? 0}
                </Text>
                <Text className="mx-2 text-xs text-[#888888]">vs</Text>
                <Text className="text-sm font-semibold text-white">
                  AI {scores.ai ?? 0}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              className="mb-3 w-full overflow-hidden rounded-xl border border-[#2A2A2A] bg-black"
              onPress={() => displayedImageUrl && setZoomImage(true)}
              activeOpacity={displayedImageUrl ? 0.85 : 1}
            >
              {displayedImageUrl ? (
                <Image
                  source={{ uri: displayedImageUrl }}
                  className="h-[200px] w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-[200px] items-center justify-center bg-[#0D0D0D]">
                  {loading ? (
                    <>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                      <Text className="mt-2.5 text-sm text-[#CCCCCC]">
                        Loading round...
                      </Text>
                    </>
                  ) : (
                    <Text className="mt-2.5 text-sm text-[#CCCCCC]">
                      Ready when you are
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>

            <Text className="mb-4 text-center text-xs text-[#888888]">
              {displayedContributor
                ? `Image by ${displayedContributor} at Mapillary, CC-BY-SA`
                : 'Images provided via Mapillary'}
            </Text>

            {status === 'in-progress' && currentRound && !latestResult && (
              <>
                <Text className="mb-2.5 text-base text-white">
                  Guess the country
                </Text>
                <TextInput
                  className="mb-3 h-[50px] w-full rounded-[10px] border border-[#444] bg-[#1E1E1E] px-4 text-base text-white"
                  value={guess}
                  onChangeText={setGuess}
                  onSubmitEditing={() => handleSubmitGuess()}
                  placeholder="e.g. Japan"
                  placeholderTextColor="#888"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  className={`items-center justify-center rounded-3xl bg-[#046C4E] px-[18px] py-3 ${
                    !guessReady || !canSubmitGuess ? 'opacity-60' : ''
                  }`}
                  onPress={handleSubmitGuess}
                  disabled={!guessReady || !canSubmitGuess}
                >
                  <Text className="text-center text-sm font-bold text-white">
                    {submitting ? 'Submitting...' : 'Lock in guess'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {awaitingNextRound && (
              <TouchableOpacity
                className="items-center justify-center rounded-3xl bg-[#2196F3] px-[18px] py-3"
                onPress={handleNextRound}
              >
                <Text className="text-center text-sm font-bold text-white">
                  Next round
                </Text>
              </TouchableOpacity>
            )}

            {completed && (
              <View className="mt-3 rounded-xl border border-[#2E7D32] bg-[#1B422E] p-3">
                <Text className="text-center text-sm text-[#A5D6A7]">
                  Match complete! Want a rematch?
                </Text>
              </View>
            )}
          </View>

          <View className="mb-5 rounded-2xl border border-[#2A2A2A] bg-[#1E1E1E] p-4">
            <Text className="mb-3 text-lg font-semibold text-white">
              Round insights
            </Text>
            {latestResult ? (
              <View className="mt-1">
                <Text className="mb-1 text-sm text-[#DDDDDD]">
                  <Text className="font-semibold text-white">
                    Correct country:{' '}
                  </Text>
                  {formatCountry(latestResult.correctCountry?.name)}
                  {latestResult.correctCountry?.code
                    ? ` (${latestResult.correctCountry.code})`
                    : ''}
                </Text>
                {coordinateText && (
                  <Text className="mb-1 text-sm text-[#DDDDDD]">
                    <Text className="font-semibold text-white">
                      Coordinates:{' '}
                    </Text>
                    {coordinateText}
                  </Text>
                )}
                <View
                  className={`mt-2 rounded-xl border p-[14px] ${
                    latestResult.playerResult?.isCorrect
                      ? 'border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.15)]'
                      : 'border-[rgba(244,67,54,0.4)] bg-[rgba(244,67,54,0.15)]'
                  }`}
                >
                  <Text className="text-xs uppercase tracking-[2px] text-white">
                    Your guess
                  </Text>
                  <Text className="mt-1.5 text-lg font-semibold text-white">
                    {latestResult.playerResult?.guess || 'No guess'}
                  </Text>
                  <Text className="mt-1 text-xs text-white">
                    {latestResult.playerResult?.isCorrect
                      ? 'Correct'
                      : 'Incorrect'}
                  </Text>
                </View>

                {latestResult.aiResult && (
                  <View className="mt-3 rounded-xl border border-[rgba(33,150,243,0.4)] bg-[rgba(33,150,243,0.15)] p-[14px]">
                    <Text className="text-xs uppercase tracking-[2px] text-[#90CAF9]">
                      AI guess
                    </Text>
                    <Text className="mt-1.5 text-lg font-semibold text-white">
                      {formatCountry(latestResult.aiResult.countryName)}
                    </Text>
                    <Text className="mt-1 text-xs text-[#90CAF9]">
                      Confidence{' '}
                      {formatConfidence(latestResult.aiResult.confidence)}
                    </Text>
                    {latestResult.aiResult.explanation ? (
                      <Text className="mt-2.5 text-sm leading-5 text-[#E3F2FD]">
                        {latestResult.aiResult.explanation}
                      </Text>
                    ) : (
                      <Text className="mt-2.5 text-sm leading-5 text-[#E3F2FD]">
                        No explanation provided.
                      </Text>
                    )}
                    {latestResult.aiResult.fallbackReason ? (
                      <Text className="mt-2 text-xs text-[#90CAF9]">
                        Fallback reason: {latestResult.aiResult.fallbackReason}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ) : (
              <Text className="text-sm leading-5 text-[#AAAAAA]">
                Submit a guess to see if you can beat the AI!
              </Text>
            )}
          </View>

          <View className="mb-5 rounded-2xl border border-[#2A2A2A] bg-[#1E1E1E] p-4">
            <Text className="mb-3 text-lg font-semibold text-white">
              Match history
            </Text>
            {history.length === 0 ? (
              <Text className="text-sm leading-5 text-[#AAAAAA]">
                Results will appear here after you complete your first round.
              </Text>
            ) : (
              history.map(round => {
                const playerCorrect = round.player?.isCorrect;
                const aiCorrect = round.ai?.isCorrect;
                return (
                  <View
                    key={round.roundIndex}
                    className="mb-3 rounded-xl border border-[#2F2F2F] bg-[#232323] p-[14px]"
                  >
                    <View className="mb-2.5 flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-white">
                        Round {round.roundIndex + 1}
                      </Text>
                      <Text className="text-[13px] text-[#BBBBBB]">
                        {formatCountry(round.correctCountry?.name)}
                        {round.correctCountry?.code
                          ? ` (${round.correctCountry.code})`
                          : ''}
                      </Text>
                    </View>
                    <View className="flex-row justify-start">
                      <View
                        className={`mr-1.5 flex-1 rounded-xl border p-3 ${
                          playerCorrect
                            ? 'border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.15)]'
                            : 'border-[rgba(244,67,54,0.4)] bg-[rgba(244,67,54,0.15)]'
                        }`}
                      >
                        <Text className="text-xs uppercase tracking-[2px] text-white">
                          You
                        </Text>
                        <Text className="mt-1.5 text-[15px] font-semibold text-white">
                          {round.player?.guess || 'No guess'}
                        </Text>
                        <Text className="mt-1 text-xs text-white">
                          {playerCorrect ? 'Correct' : 'Incorrect'}
                        </Text>
                      </View>
                      <View
                        className={`ml-1.5 flex-1 rounded-xl border p-3 ${
                          aiCorrect
                            ? 'border-[rgba(33,150,243,0.4)] bg-[rgba(33,150,243,0.15)]'
                            : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        <Text className="text-xs uppercase tracking-[2px] text-white">
                          AI
                        </Text>
                        <Text className="mt-1.5 text-[15px] font-semibold text-white">
                          {round.ai
                            ? formatCountry(round.ai.countryName)
                            : 'No guess'}
                        </Text>
                        {round.ai ? (
                          <Text className="mt-1 text-xs text-[#90CAF9]">
                            Confidence {formatConfidence(round.ai.confidence)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <Modal
          visible={zoomImage}
          transparent={true}
          onRequestClose={() => setZoomImage(false)}
        >
          <ImageViewer
            imageUrls={[{ url: displayedImageUrl ?? '' }]}
            onCancel={() => setZoomImage(false)}
            enableSwipeDown={true}
            onSwipeDown={() => setZoomImage(false)}
            saveToLocalByLongPress={false}
          />
        </Modal>
      </SafeAreaView>
    </View>
  );
};

export default AiDuel;
