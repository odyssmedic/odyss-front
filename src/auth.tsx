import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, clearCsrf } from "./api";
import type { User } from "./types";
const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  error: "",
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setUser(await api<User>("/auth/me"));
    } catch (e) {
      setUser(null);
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    clearCsrf();
    sessionStorage.clear();
    setUser(null);
  }
  useEffect(() => {
    void refresh();
    const expired = () => {
      setUser(null);
      clearCsrf();
    };
    window.addEventListener("odyss:expired", expired);
    return () => window.removeEventListener("odyss:expired", expired);
  }, []);
  return (
    <Context.Provider value={{ user, loading, error, refresh, logout }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
