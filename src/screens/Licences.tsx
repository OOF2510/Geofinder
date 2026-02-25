import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/navigationTypes';
import type { RootStackParamList } from '../navigation/navigationTypes';

const Licences: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleBack = () => {
    navigation.navigate('MainMenu');
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(error => {
      console.error('Failed to open link:', error);
    });
  };

  const renderLink = (url: string, label?: string) => (
    <Text
      key={url}
      className="text-[#4da6ff] underline"
      onPress={() => handleOpenLink(url)}
    >
      {label ?? url}
    </Text>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <View className="flex-row items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-5 py-2.5">
        <TouchableOpacity onPress={handleBack} className="p-2.5">
          <Text className="text-base font-bold text-[rgba(255,255,255,0.9)]">
            ← Back
          </Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Licenses</Text>
        <View className="w-[60px]" />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5"
      >
        <View className="mb-5 border-b border-[rgba(255,255,255,0.1)] pb-2.5">
          <Text className="mb-2.5 text-lg font-bold text-white">
            Mapillary Images
          </Text>
          <Text className="text-sm leading-5 text-[rgba(255,255,255,0.8)]">
            Images provided via Mapillary, licensed under CC-BY-SA 4.0.{'\n'}
            For more details:{' '}
            {renderLink('https://www.mapillary.com/app/licenses')}
          </Text>
        </View>

        <View className="mb-5 border-b border-[rgba(255,255,255,0.1)] pb-2.5">
          <Text className="mb-2.5 text-lg font-bold text-white">
            OpenStreetMap Data
          </Text>
          <Text className="text-sm leading-5 text-[rgba(255,255,255,0.8)]">
            Map data provided by OpenStreetMap, licensed under ODbL 1.0.{'\n'}
            For more details:{' '}
            {renderLink('https://www.openstreetmap.org/copyright')}
          </Text>
        </View>

        <View className="mb-5 border-b border-[rgba(255,255,255,0.1)] pb-2.5">
          <Text className="mb-2.5 text-lg font-bold text-white">
            Fallback Map Data
          </Text>
          <Text className="text-sm leading-5 text-[rgba(255,255,255,0.8)]">
            Fallback map data provided by:{'\n'}-{' '}
            {renderLink(
              'https://www.bigdatacloud.com/terms',
              'BigDataCloud (CC-BY-4.0)',
            )}
            {'\n'}-{' '}
            {renderLink(
              'https://www.openmetromaps.org',
              'Open-Metro (CC-BY-4.0)',
            )}
            {'\n'}- Geonames (
            {renderLink(
              'http://creativecommons.org/licenses/by-sa/4.0/',
              'CC-BY-SA 4.0',
            )}
            )
          </Text>
        </View>

        <View className="mb-5 border-b border-[rgba(255,255,255,0.1)] pb-2.5">
          <Text className="mb-2.5 text-lg font-bold text-white">
            AI Models
          </Text>
          <Text className="text-sm leading-5 text-[rgba(255,255,255,0.8)]">
            AI models used for AI 1v1 provided by OpenRouter:{'\n'}- Mistral
            Small 3.1 24B Instruct: licensed under Apache-2.0{'\n'}- Google
            Gemma 3 27B: Gemma is provided under and subject to the Gemma Terms
            of Use found at {renderLink('https://ai.google.dev/gemma/terms')}
            {'\n'}- NVIDIA Nemotron Nano 12B v2 VL: licensed under the NVIDIA
            Open Model License{'\n'}
            For more details on Apache-2.0:{' '}
            {renderLink('https://www.apache.org/licenses/LICENSE-2.0')}
          </Text>
        </View>

        <View className="mb-5 border-b border-[rgba(255,255,255,0.1)] pb-2.5">
          <Text className="mb-2.5 text-lg font-bold text-white">
            App Libraries
          </Text>
          <Text className="text-sm leading-5 text-[rgba(255,255,255,0.8)]">
            This app uses the following open-source libraries:{'\n'}- React
            Native: MIT License{'\n'}- React Navigation: MIT License{'\n'}- And
            others as per their package.json files.{'\n'}
            {'\n'}
            For full licenses, refer to{' '}
            {renderLink(
              'https://github.com/oof2510/GeoguessApp/blob/main/bun.lock',
              'bun.lock',
            )}
            .
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Licences;
