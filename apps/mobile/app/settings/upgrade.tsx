import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useRevenueCat } from '../../hooks/useRevenueCat';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function UpgradeScreen() {
  const router = useRouter();
  const { packages, isLoading, purchase, restorePurchases, error } = useRevenueCat();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = async (packageId: string) => {
    setSelectedPackage(packageId);
    setIsPurchasing(true);
    try {
      const success = await purchase(packageId);
      if (success) {
        Alert.alert('Success', 'Thank you for upgrading!', [
          {
            text: 'Done',
            onPress: () => {
              router.back();
            },
          },
        ]);
      } else {
        Alert.alert('Error', error || 'Purchase failed. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
      setSelectedPackage(null);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Restored', 'Your purchases have been restored.');
      } else {
        Alert.alert('Error', 'Failed to restore purchases.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-green-deep" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="pt-6 pb-4 px-6 border-b-2 border-gold">
        <Text className="text-[13px] tracking-[4px] uppercase text-gold font-semibold mb-2">
          Upgrade
        </Text>
        <Text className="text-2xl text-white mb-2" style={{ fontFamily: 'serif' }}>
          Get Pro
        </Text>
        <Text className="text-cream-dim text-sm">
          Unlock unlimited playbooks, AI lessons, and course memory.
        </Text>
      </View>

      {/* Packages */}
      <View className="p-6 gap-3">
        {isLoading ? (
          <Card className="py-12 items-center">
            <Text className="text-cream-dim">Loading packages...</Text>
          </Card>
        ) : packages.length > 0 ? (
          packages.map((pkg) => (
            <Pressable
              key={pkg.id}
              onPress={() => handlePurchase(pkg.id)}
              disabled={isPurchasing}
              className={`border-2 rounded-xl overflow-hidden ${
                selectedPackage === pkg.id
                  ? 'border-gold bg-gold/10'
                  : 'border-gold/20 bg-green-card'
              }`}
            >
              <View className="p-5">
                <View className="flex-row justify-between items-baseline mb-2">
                  <Text className="text-xl text-white font-bold">{pkg.title}</Text>
                  <Text className="text-2xl text-gold font-bold">${pkg.price}</Text>
                </View>
                <Text className="text-xs text-cream-dim mb-3">{pkg.periodString}</Text>
                <Text className="text-cream text-sm mb-4">{pkg.description}</Text>

                <Button
                  title={
                    selectedPackage === pkg.id && isPurchasing
                      ? 'Processing...'
                      : `Subscribe for ${pkg.priceString}`
                  }
                  onPress={() => handlePurchase(pkg.id)}
                  loading={selectedPackage === pkg.id && isPurchasing}
                />
              </View>
            </Pressable>
          ))
        ) : (
          <Card className="py-8 items-center">
            <Text className="text-cream-dim">No packages available</Text>
          </Card>
        )}
      </View>

      {/* Restore & Support */}
      <View className="px-6 pb-6">
        <Card className="mb-4">
          <View className="p-5">
            <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-3">
              Already a subscriber?
            </Text>
            <Button
              title="Restore Purchases"
              onPress={handleRestore}
              variant="secondary"
              disabled={isPurchasing}
            />
            <Text className="text-xs text-cream-dim text-center mt-3">
              If you've already purchased Pro on another device, tap to restore your subscription.
            </Text>
          </View>
        </Card>

        <Card>
          <View className="p-5">
            <Text className="text-xs tracking-[2px] uppercase text-gold font-bold mb-3">
              Questions?
            </Text>
            <Text className="text-cream-dim text-sm leading-5">
              Contact support@aicaddie.app or check our FAQ at aicaddie.app/help
            </Text>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
