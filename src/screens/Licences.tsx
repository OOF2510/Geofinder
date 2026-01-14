import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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
    <Text key={url} style={styles.link} onPress={() => handleOpenLink(url)}>
      {label ?? url}
    </Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Licenses</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mapillary Images</Text>
          <Text style={styles.licenseText}>
            Images provided via Mapillary, licensed under CC-BY-SA 4.0.{'\n'}
            For more details:{' '}
            {renderLink('https://www.mapillary.com/app/licenses')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OpenStreetMap Data</Text>
          <Text style={styles.licenseText}>
            Map data provided by OpenStreetMap, licensed under ODbL 1.0.{'\n'}
            For more details:{' '}
            {renderLink('https://www.openstreetmap.org/copyright')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fallback Map Data</Text>
          <Text style={styles.licenseText}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Models</Text>
          <Text style={styles.licenseText}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Libraries</Text>
          <Text style={styles.licenseText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 60, // Placeholder for alignment
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  licenseText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: '#4da6ff',
    textDecorationLine: 'underline',
  },
});

export default Licences;
