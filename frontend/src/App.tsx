import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "./config/wagmi";
import Layout from "./components/layout/Layout";
import ClientPortal from "./pages/ClientPortal";
import WorkerMarketplace from "./pages/WorkerMarketplace";
import TaskDetailPage from "./pages/TaskDetailPage";
import MyTasks from "./pages/MyTasks";
import AgentDashboard from "./pages/AgentDashboard";

const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#2563eb", borderRadius: "medium" })}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<ClientPortal />} />
                <Route path="/work" element={<WorkerMarketplace />} />
                <Route path="/work/:taskId" element={<TaskDetailPage />} />
                <Route path="/my-tasks" element={<MyTasks />} />
                <Route path="/dashboard" element={<AgentDashboard />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
