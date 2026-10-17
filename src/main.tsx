import { Journey, Progress, Diagnostic } from "./journey";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "./auth";
import {
  Account,
  Home,
  Landing,
  Protected,
  RouteView,
  SessionView,
  SummaryView,
} from "./pages";
import "./legacy.css";
import "./styles.css";
function SessionEntry() {
  const { sessionId } = useParams();
  return <SessionView key={sessionId} />;
}
function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const title = document.querySelector("h1");
      if (title instanceof HTMLElement) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    });
  }, [pathname]);
  return null;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RouteFocus />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/registro"
            element={<Account key="register" mode="register" />}
          />
          <Route
            path="/ingresar"
            element={<Account key="login" mode="login" />}
          />
          <Route
            path="/recuperar"
            element={<Account key="forgot" mode="forgot" />}
          />
          <Route
            path="/restablecer"
            element={<Account key="reset" mode="reset" />}
          />
          <Route path="/app" element={<Protected />}>
            <Route index element={<Home />} />
            <Route path="mundos" element={<Journey />} />
            <Route path="mi-ruta" element={<Journey />} />
            <Route path="progreso" element={<Progress />} />
            <Route path="diagnostico" element={<Diagnostic />} />
            <Route path="rutas/:routeId" element={<RouteView />} />
            <Route path="sesiones/:sessionId" element={<SessionEntry />} />
            <Route
              path="sesiones/:sessionId/resumen"
              element={<SummaryView />}
            />
          </Route>
          <Route
            path="*"
            element={
              <main className="content">
                <h1>Página no encontrada</h1>
                <Link to="/">Volver al inicio</Link>
              </main>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
