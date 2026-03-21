import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUpdateClubs } from '../../hooks/useProfile';
import { Button } from '../../components/ui/Button';

interface ClubEntry {
  clubName: string;
  clubType: string;
  carryDistance: string;
  isFairwayFinder: boolean;
}

const PRESET_CLUBS: ClubEntry[] = [
  { clubName: 'Driver', clubType: 'driver', carryDistance: '', isFairwayFinder: false },
  { clubName: '3-Wood', clubType: 'wood', carryDistance: '', isFairwayFinder: false },
  { clubName: '3-Hybrid', clubType: 'hybrid', carryDistance: '', isFairwayFinder: false },
  { clubName: '4-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: '5-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: '6-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: '7-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: '8-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: '9-Iron', clubType: 'iron', carryDistance: '', isFairwayFinder: false },
  { clubName: 'PW', clubType: 'wedge', carryDistance: '', isFairwayFinder: false },
  { clubName: 'GW', clubType: 'wedge', carryDistance: '', isFairwayFinder: false },
  { clubName: 'SW', clubType: 'wedge', carryDistance: '', isFairwayFinder: false },
  { clubName: 'LW', clubType: 'wedge', carryDistance: '', isFairwayFinder: false },
  { clubName: 'Putter', clubType: 'putter', carryDistance: '', isFairwayFinder: false },
];

export default function BagScreen() {
  const router = useRouter();
  const updateClubs = useUpdateClubs();
  const [clubs, setClubs] = useState<ClubEntry[]>(PRESET_CLUBS);

  const toggleClub = (index: number) => {
    // Clear distance to remove, set to '0' to add back
    Haptics.selectionAsync();
    const updated = [...clubs];
    if (updated[index].carryDistance === 'REMOVED') {
      updated[index].carryDistance = '';
    } else {
      updated[index].carryDistance = 'REMOVED';
    }
    setClubs(updated);
  };

  const setDistance = (index: number, value: string) => {
    const updated = [...clubs];
    updated[index].carryDistance = value;
    setClubs(updated);
  };

  const toggleFairwayFinder = (index: number) => {
    Haptics.selectionAsync();
    const updated = [...clubs];
    updated[index].isFairwayFinder = !updated[index].isFairwayFinder;
    setClubs(updated);
  };

  const handleNext = () => {
    const activeclubs = clubs
      .filter((c) => c.carryDistance !== 'REMOVED')
      .map((c, i) => ({
        clubName: c.clubName,
        clubType: c.clubType,
        carryDistance: parseInt(c.carryDistance) || undefined,
        isFairwayFinder: c.isFairwayFinder,
        sortOrder: i,
      }));

    if (activeclubs.length < 3) {
      Alert.alert('Too few clubs', 'Add at least 3 clubs to your bag.');
      return;
    }

    updateClubs.mutate(activeclubs, {
      onSuccess: () => router.push('/onboarding/shot-shape'),
    });
  };

  return (
    <ScrollView className="flex-1 bg-green-deep px-6" keyboardShouldPersistTaps="handled">
      <View className="pt-8 pb-4">
        <Text className="text-3xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          What's in Your Bag?
        </Text>
        <Text className="text-base text-cream-dim leading-6">
          Enter carry distances. Tap ★ to mark your go-to fairway finder clubs.
          Tap a club name to remove it.
        </Text>
      </View>

      {clubs.map((club, i) => {
        const removed = club.carryDistance === 'REMOVED';
        return (
          <View
            key={club.clubName}
            className={`flex-row items-center py-3 border-b border-gold/10 ${
              removed ? 'opacity-30' : ''
            }`}
          >
            <Pressable onPress={() => toggleClub(i)} className="flex-1">
              <Text
                className={`text-base font-semibold ${removed ? 'text-cream-dim line-through' : 'text-cream'}`}
              >
                {club.clubName}
              </Text>
            </Pressable>

            {!removed && club.clubType !== 'putter' && (
              <>
                <TextInput
                  className="bg-black/30 border border-gold/15 rounded-lg px-3 py-2 text-cream text-center w-20 mr-3"
                  placeholder="yds"
                  placeholderTextColor="#b8a88844"
                  keyboardType="number-pad"
                  value={club.carryDistance}
                  onChangeText={(v) => setDistance(i, v)}
                  accessibilityLabel={`${club.clubName} carry distance`}
                />
                <Pressable onPress={() => toggleFairwayFinder(i)}>
                  <Text className={`text-2xl ${club.isFairwayFinder ? 'text-gold' : 'text-cream-dim/30'}`}>
                    ★
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        );
      })}

      <View className="mt-6 mb-10">
        <Button
          title="Next: Shot Shape"
          onPress={handleNext}
          loading={updateClubs.isPending}
        />
      </View>
    </ScrollView>
  );
}
