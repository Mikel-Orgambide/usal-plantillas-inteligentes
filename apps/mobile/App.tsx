import { StatusBar } from "expo-status-bar";
import { SimulatorScreen } from "./src/presentation/SimulatorScreen";

export default function App() {
  return (
    <>
      <SimulatorScreen />
      <StatusBar style="auto" />
    </>
  );
}
