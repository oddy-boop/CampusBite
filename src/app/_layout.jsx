import { Stack } from "expo-router";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CartProvider>
        <Stack
          screenOptions={{ headerShown: false }}
          initialRouteName="index"
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="vendor-menu" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="order-success" />
          <Stack.Screen name="vendor-dashboard" />
        </Stack>
      </CartProvider>
    </ThemeProvider>
  );
}
