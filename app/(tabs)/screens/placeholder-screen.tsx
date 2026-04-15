// screens/PlaceholderScreens.tsx
import { StyleSheet, Text, View } from 'react-native'

const Screen = ({ name }: { name: string }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{name} Page</Text>
  </View>
)

export const Home = () => <Screen name="Home" />
export const Menu = () => <Screen name="Menu" />
export const Gift = () => <Screen name="Gift" />
export const Profile = () => <Screen name="Profile" />

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: { fontSize: 18, fontWeight: '500' },
})
