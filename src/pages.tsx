import { PreferenceFields, SessionSetup, DemoNotice } from "./journey";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { all, api, ApiError } from "./api";
import { useAuth } from "./auth";
import {
  Brand,
  Competencies,
  Failure,
  History,
  Loading,
  Notice,
  useResource,
  competencyNames,
  UnavailablePractice,
  RecommendationStatus,
} from "./components";
import type {
  Answer,
  Axis,
  Item,
  LearningRoute,
  Practice,
  PracticeAvailability,
  SessionRow,
  Student,
  Summary,
} from "./types";

export function Landing() {
  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
        <Link className="btn btn-soft" to="/ingresar">
          Ingresar
        </Link>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">Del conocimiento a la práctica</div>
            <h1 className="serif">Una ruta que avanza contigo.</h1>
            <p>
              Explora los mundos clínicos disponibles y practica según tus
              intereses. Tus respuestas construyen tu siguiente recorrido.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/registro?intent=explore">
                Comenzar desde cero →
              </Link>
              <Link className="btn btn-soft" to="/registro?intent=diagnostic">
                Explorar mi ruta
              </Link>
            </div>
            <Notice>
              Practica con los casos del banco del proyecto. La revisión clínica
              del contenido sigue pendiente.
            </Notice>
          </div>
          <div className="hero-card">
            <div className="eyebrow">Tu siguiente paso</div>
            <div className="ecg" aria-hidden="true">
              <svg viewBox="0 0 600 120" fill="none">
                <path
                  d="M0 65H150L175 65L190 20L208 105L228 65H600"
                  stroke="#67d9cd"
                  strokeWidth="5"
                />
              </svg>
            </div>
            <h2>Mundos clínicos</h2>
            <p>Elige tu área de interés y construye tu recorrido.</p>
            <div className="steps">
              <div className="step">01 · Explora</div>
              <div className="step">02 · Practica</div>
              <div className="step">03 · Avanza</div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="section-inner cards">
            {[
              [
                "Un paso a la vez",
                "Recibe la información disponible para cada pregunta.",
              ],
              [
                "Aprende de tu respuesta",
                "Lee el feedback y continúa cuando estés listo.",
              ],
              [
                "Conserva tu progreso",
                "Retoma tu práctica y consulta tus resultados.",
              ],
            ].map(([title, text]) => (
              <article className="info-card" key={title}>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const passwordRecoveryEnabled =
  import.meta.env.VITE_PASSWORD_RECOVERY_ENABLED === "true";

const stages = [
  ["student", "Estudiante por año académico"],
  ["fourth_year", "Cuarto año"],
  ["extern", "Externado"],
  ["intern", "Internado"],
  ["general_practitioner", "Médico general"],
  ["resident", "Residencia"],
];
export function Account({
  mode,
}: {
  mode: "register" | "login" | "forgot" | "reset";
}) {
  const auth = useAuth(),
    navigate = useNavigate();
  const [world, setWorld] = useState(""),
    [specialties, setSpecialties] = useState<string[]>([]);
  const [intent] = useState(() =>
    new URLSearchParams(window.location.search).get("intent") === "diagnostic"
      ? "diagnostic"
      : "explore",
  );
  const destination = intent === "diagnostic" ? "/app/diagnostico" : "/app";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [stage, setStage] = useState("fourth_year");
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    if (mode === "reset" && window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
  }, [mode]);
  const titles = {
    register: "Comienza tu recorrido.",
    login: "Continúa donde te quedaste.",
    forgot: "Recupera tu acceso.",
    reset: "Elige una nueva contraseña.",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "register" || mode === "login") {
        if (mode === "register" && !specialties.length)
          throw new Error("Elige al menos una especialidad de interés.");
        const body =
          mode === "register"
            ? {
                name: form.get("name"),
                email: form.get("email"),
                password: form.get("password"),
                stage,
                ...(stage === "fourth_year"
                  ? { academic_year: 4 }
                  : stage === "student"
                    ? { academic_year: Number(form.get("academic_year")) }
                    : {}),
                university: form.get("university"),
                career: form.get("career"),
                training_goal: form.get("training_goal"),
                entry_mode: intent,
                discipline_id: world,
                specialty_ids: specialties,
              }
            : { email: form.get("email"), password: form.get("password") };
        await api(`/auth/${mode}`, { method: "POST", body });
        await auth.refresh();
        navigate(destination, { replace: true });
      } else if (mode === "forgot") {
        const result = await api<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: { email: form.get("email") },
        });
        setMessage(result.message);
      } else {
        if (form.get("password") !== form.get("confirm"))
          throw new Error("Las contraseñas no coinciden.");
        const result = await api<{ message: string }>("/auth/reset-password", {
          method: "POST",
          body: { token, password: form.get("password") },
        });
        await auth.refresh();
        setMessage(result.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (auth.user && (mode === "login" || mode === "register"))
    return <Navigate to={destination} replace />;
  if (!passwordRecoveryEnabled && (mode === "forgot" || mode === "reset")) {
    return (
      <main className="auth">
        <section className="auth-box">
          <Brand />
          <h1>Recuperación no disponible</h1>
          <p>La recuperación por correo todavía no está habilitada.</p>
          <Link to="/ingresar">Volver a ingresar</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="auth">
      <section className="auth-box">
        <Brand />
        <h1 className="serif">{titles[mode]}</h1>
        <p className="muted">
          {mode === "register"
            ? "Cuéntanos quién eres para guardar tus rutas y resultados."
            : mode === "forgot"
              ? "Enviaremos un enlace si el correo pertenece a una cuenta."
              : "Tu progreso te espera."}
        </p>
        {error && <Failure message={error} />}{" "}
        {message ? (
          <>
            <Notice>{message}</Notice>
            <Link className="btn btn-primary" to="/ingresar">
              Ir a ingresar
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <PreferenceFields
                  {...{ world, setWorld, specialties, setSpecialties }}
                />
                <label className="field">
                  Objetivo de entrenamiento
                  <textarea
                    name="training_goal"
                    required
                    maxLength={1000}
                    placeholder="¿Qué quieres reforzar?"
                  />
                </label>
              </>
            )}
            {mode !== "reset" && (
              <label className="field">
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label className="field">
                Contraseña
                <input
                  aria-label="Contraseña"
                  name="password"
                  type="password"
                  required
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
                {mode !== "login" && <small>Al menos 12 caracteres.</small>}
              </label>
            )}
            {mode === "register" && (
              <>
                <label className="field">
                  Nombre
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={200}
                  />
                </label>
                <label className="field">
                  Universidad
                  <input name="university" required maxLength={200} />
                </label>
                <label className="field">
                  Carrera
                  <input name="career" required maxLength={200} />
                </label>
                {stage === "student" && (
                  <label className="field">
                    Año académico
                    <input
                      name="academic_year"
                      type="number"
                      min={1}
                      max={10}
                      required
                    />
                  </label>
                )}
                <label className="field">
                  Etapa académica
                  <select
                    name="stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    {stages.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {mode === "reset" && (
              <label className="field">
                Confirmar contraseña
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            )}
            {mode === "reset" && !token ? (
              <Failure message="Abre el enlace recibido por correo para restablecer tu contraseña." />
            ) : (
              <button className="btn btn-primary full" disabled={busy}>
                {busy
                  ? "Procesando…"
                  : {
                      register: "Crear cuenta",
                      login: "Ingresar",
                      forgot: "Enviar enlace",
                      reset: "Guardar contraseña",
                    }[mode]}
              </button>
            )}
          </form>
        )}
        <div className="account-links">
          {mode === "login" ? (
            <>
              <Link to={`/registro?intent=${intent}`}>Crear cuenta</Link>
              {passwordRecoveryEnabled && (
                <Link to="/recuperar">Olvidé mi contraseña</Link>
              )}
            </>
          ) : (
            <Link to={`/ingresar?intent=${intent}`}>Ya tengo una cuenta</Link>
          )}
          <Link to="/">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}

export function Protected() {
  const auth = useAuth(),
    location = useLocation();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("odyss:sidebar") === "collapsed",
  );
  if (auth.loading) return <Loading />;
  if (auth.error)
    return (
      <main className="content">
        <Failure message={auth.error} retry={() => void auth.refresh()} />
      </main>
    );
  if (!auth.user)
    return (
      <Navigate to="/ingresar" state={{ from: location.pathname }} replace />
    );
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await auth.logout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`dashboard-shell app-shell ${collapsed ? "is-collapsed" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <aside className="app-sidebar">
        <div className="side-brand">
          <Link className="brand" to="/app">
            <span className="brand-mark" aria-hidden="true">
              <span className="pulse" />
            </span>
            <span className="nav-label">OdyssMedic</span>
          </Link>
          <button
            className="collapse"
            aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
            aria-expanded={!collapsed}
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem(
                "odyss:sidebar",
                next ? "collapsed" : "expanded",
              );
            }}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <NavLink end to="/app" title="Inicio">
            <span aria-hidden="true">⌂</span>
            <span className="nav-label">Inicio</span>
          </NavLink>
          <NavLink
            to="/app/mi-ruta"
            title="Mi ruta"
            className={({ isActive }) =>
              isActive ||
              /\/app\/(rutas|sesiones|mundos|diagnostico)/.test(
                location.pathname,
              )
                ? "active"
                : ""
            }
          >
            <span aria-hidden="true">→</span>
            <span className="nav-label">Mi ruta</span>
          </NavLink>
          <NavLink to="/app/progreso" title="Mi progreso">
            <span aria-hidden="true">◔</span>
            <span className="nav-label">Mi progreso</span>
          </NavLink>
        </nav>
        <div className="side-account">
          <div className="avatar" aria-hidden="true">
            {auth.user.student.name.slice(0, 1).toUpperCase()}
          </div>
          <span className="nav-label">{auth.user.student.name}</span>
        </div>
        <button
          className="btn sidebar-logout"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          disabled={busy}
          onClick={() => void logout()}
        >
          <span aria-hidden="true">↪</span>
          <span className="nav-label">
            {busy ? "Saliendo…" : "Cerrar sesión"}
          </span>
        </button>
      </aside>
      <main id="main-content" className="content">
        <div className="user-line">Hola, {auth.user.student.name}</div>
        <DemoNotice />
        {error && <Failure message={error} />}
        <Outlet />
      </main>
    </div>
  );
}

export function Home() {
  const { user } = useAuth();
  const resource = useResource(
    async (signal) => {
      const [profile, routes, sessions] = await Promise.all([
        api<{ student: Student; total_exp: number }>(
          `/students/${user!.student.id}`,
          { signal },
        ),
        all<LearningRoute>("/routes", signal),
        all<SessionRow>(`/students/${user!.student.id}/sessions`, signal),
      ]);
      return { profile, routes, sessions };
    },
    [user!.student.id],
  );
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <Failure message={resource.error} retry={resource.retry} />;
  const { profile, routes, sessions } = resource.data!;
  const active = sessions.find((s) => s.status === "active"),
    completed = sessions.filter((s) => s.status === "completed");
  return (
    <>
      <div className="welcome">
        <div className="eyebrow">Tu recorrido</div>
        <h1 className="serif">Cada decisión cuenta.</h1>
        <p className="muted">
          Practica, revisa tus respuestas y sigue avanzando.
        </p>
      </div>
      <div className="stats">
        <article className="stat">
          <small>Prácticas completadas</small>
          <strong>{completed.length}</strong>
        </article>
        <article className="stat">
          <small>EXP acumulada</small>
          <strong>{profile.total_exp}</strong>
        </article>
        <article className="stat">
          <small>Rutas disponibles</small>
          <strong>{routes.filter((r) => !r.archived).length}</strong>
        </article>
      </div>
      {active && (
        <section className="panel continuation">
          <h2>Tu práctica está en curso</h2>
          <p>
            {active.answered} de {active.total_questions} preguntas respondidas.
          </p>
          <Link className="btn btn-primary" to={`/app/sesiones/${active.id}`}>
            Continuar práctica →
          </Link>
        </section>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Mis rutas</h2>
          <Link className="btn btn-soft" to="/app/mi-ruta">
            Explorar mundos
          </Link>
        </div>
        {routes.filter((r) => !r.archived).length === 0 ? (
          <p className="muted">
            Elige un mundo clínico para crear tu primera ruta.
          </p>
        ) : (
          <div className="route-list">
            {routes
              .filter((r) => !r.archived)
              .map((r) => (
                <Link
                  className="route-item"
                  key={r.id}
                  to={`/app/rutas/${r.id}`}
                >
                  <span className="route-num">→</span>
                  <strong>{r.name}</strong>
                </Link>
              ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Mi historial</h2>
        <History sessions={sessions} />
      </section>
    </>
  );
}

export function RouteView() {
  const { routeId } = useParams(),
    { user } = useAuth();
  const availabilityResource = useResource(
    (signal) =>
      api<PracticeAvailability>(`/routes/${routeId}/availability`, { signal }),
    [routeId],
  );
  const resource = useResource(
    async (signal) => {
      const route = await api<LearningRoute>(`/routes/${routeId}`, { signal });
      const [sessions, active, radar] = await Promise.all([
        all<SessionRow>(
          `/students/${user!.student.id}/sessions?route_id=${routeId}`,
          signal,
        ),
        all<SessionRow>(
          `/students/${user!.student.id}/sessions?status=active`,
          signal,
        ),
        api<{ axes: Axis[] }>(
          `/students/${user!.student.id}/competencies?topic_id=${route.topic_id}`,
          { signal },
        ),
      ]);
      return { route, sessions, active, radar };
    },
    [routeId, user!.student.id],
  );
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <Failure message={resource.error} retry={resource.retry} />;
  const { route, sessions, active, radar } = resource.data!;
  const completed = sessions.filter((s) => s.status === "completed").length;
  return (
    <>
      <div className="welcome">
        <div className="eyebrow">Mi ruta · Dificultad inicial básica</div>
        <h1 className="serif">{route.name}</h1>
        <p className="muted">
          {completed} prácticas completadas. Configura tus casos y preguntas
          antes de comenzar.
        </p>
      </div>
      <section className="panel">
        <h2>
          {active.length ? "Continúa tu práctica" : "Tu siguiente práctica"}
        </h2>
        {active.length ? (
          <>
            <p>
              {active[0].route_id === route.id
                ? "Tienes una práctica pendiente en esta ruta."
                : "Tienes una práctica pendiente en otra ruta. Complétala antes de iniciar una nueva."}
            </p>
            <Link
              className="btn btn-primary"
              to={`/app/sesiones/${active[0].id}`}
            >
              Continuar práctica →
            </Link>
          </>
        ) : route.archived ? (
          <>
            <Notice>Esta ruta está archivada.</Notice>
            <Link className="btn btn-primary" to="/app/mi-ruta">
              Elegir un tema disponible →
            </Link>
          </>
        ) : availabilityResource.loading ? (
          <Loading />
        ) : availabilityResource.error ? (
          <Failure
            message={availabilityResource.error}
            retry={availabilityResource.retry}
          />
        ) : availabilityResource.data!.eligible_cases === 0 ? (
          <>
            <UnavailablePractice availability={availabilityResource.data!} />
            <Link className="btn btn-primary" to="/app/mi-ruta">
              Elegir un tema disponible →
            </Link>
          </>
        ) : (
          <>
            <p>
              Responde, lee el feedback y avanza a tu ritmo. El motor utiliza tu
              desempeño acumulado para seleccionar las preguntas.
            </p>
            <SessionSetup routeId={route.id} />
          </>
        )}
      </section>
      <div className="grid2">
        <section className="panel">
          <h2>Mi progreso por competencia</h2>
          <Competencies axes={radar.axes} />
        </section>
        <section className="panel">
          <h2>Prácticas de esta ruta</h2>
          <History sessions={sessions} />
        </section>
      </div>
    </>
  );
}

type Pending = {
  snapshot: Practice;
  option: string;
  key: string;
  result?: Answer;
};
function clinicalText(text: string) {
  const labels: Record<string, string> = {
    resultados_y_conclusiones: "Resultados",
    evolucion_durante_atencion: "Evolución",
    estudios_y_hallazgos: "Estudios",
    seguimiento: "Seguimiento",
  };
  return text
    .replace(
      /^(resultados_y_conclusiones|evolucion_durante_atencion|estudios_y_hallazgos|seguimiento):/gm,
      (_, field: string) => `${labels[field]}:`,
    )
    .replace(
      /Información disponible para P(\d+):/g,
      "Paso $1 · Información adicional:",
    );
}
export function SessionView() {
  const { sessionId } = useParams(),
    { user } = useAuth(),
    navigate = useNavigate();
  const storageKey = `odyss:${user!.student.id}:${sessionId}`;
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  });
  const [selected, setSelected] = useState(pending?.option || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sending = useRef(false);
  const resource = useResource(
    (signal) => api<Practice>(`/sessions/${sessionId}`, { signal }),
    [sessionId],
  );
  useEffect(() => {
    try {
      const saved: Pending | null = JSON.parse(
        sessionStorage.getItem(storageKey) || "null",
      );
      setPending(saved);
      setSelected(saved?.option || "");
    } catch {
      setPending(null);
      setSelected("");
    }
    setError("");
  }, [storageKey]);
  useEffect(() => {
    if (resource.data?.status === "cancelled") {
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setSelected("");
    }
  }, [storageKey, resource.data?.status]);
  const [presentedId, setPresentedId] = useState("");
  const questionToPresent =
    pending || resource.loading || resource.data?.status !== "active"
      ? undefined
      : resource.data.current_question?.id;
  useEffect(() => {
    if (!questionToPresent) return;
    const controller = new AbortController();
    setPresentedId("");
    api(`/sessions/${sessionId}/presentations`, {
      method: "POST",
      body: { question_id: questionToPresent },
      signal: controller.signal,
    })
      .then(() => {
        if (!controller.signal.aborted) setPresentedId(questionToPresent);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => controller.abort();
  }, [sessionId, questionToPresent]);
  function store(value: Pending | null) {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
    setPending(value);
  }
  async function answer() {
    if (
      sending.current ||
      resource.loading ||
      resource.data?.status === "cancelled"
    )
      return;
    const snapshot = pending?.snapshot || resource.data;
    if (!snapshot?.current_question) return;
    if (!pending && !selected) {
      setError("Selecciona una alternativa para responder.");
      return;
    }
    const attempt = pending || {
      snapshot,
      option: selected,
      key: crypto.randomUUID(),
    };
    store(attempt);
    setBusy(true);
    sending.current = true;
    setError("");
    try {
      const result = await api<Answer>(`/sessions/${sessionId}/answers`, {
        method: "POST",
        key: attempt.key,
        body: {
          question_id: attempt.snapshot.current_question!.id,
          option_id: attempt.option,
        },
      });
      store({ ...attempt, result });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) resource.retry();
      setError((e as Error).message);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }
  function next() {
    const result = pending?.result;
    store(null);
    setSelected("");
    setError("");
    if (result?.session.status === "completed")
      navigate(`/app/sesiones/${sessionId}/resumen`);
    else resource.retry();
  }
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <Failure message={resource.error} retry={resource.retry} />;
  if (resource.data?.status === "cancelled")
    return <Navigate to={`/app/sesiones/${sessionId}/resumen`} replace />;
  const session = pending?.snapshot || resource.data;
  if (!session) return <Loading />;
  if (session.status === "completed" && !pending)
    return <Navigate to={`/app/sesiones/${sessionId}/resumen`} replace />;
  if (!session.current_question || !session.current_case)
    return (
      <Failure
        message="No hay una pregunta disponible."
        retry={resource.retry}
      />
    );
  const question = session.current_question,
    currentCase = session.current_case,
    feedback = pending?.result;
  return (
    <>
      <div className="practice-top">
        <Link to={`/app/rutas/${session.route_id}`}>← Mi ruta</Link>
        <span>
          Pregunta {session.answered + 1} de {session.total_questions}
        </span>
      </div>
      <progress
        className="session-progress"
        max={session.total_questions}
        value={feedback ? feedback.session.answered : session.answered}
        aria-label="Preguntas respondidas"
      />
      <div className="case-layout">
        <section className="panel">
          {currentCase.demo && (
            <Notice>
              {currentCase.content_kind === "clinical_demo"
                ? "Caso del banco clínico del proyecto, preparado para demo local y pendiente de revisión clínica."
                : "Contenido sintético de prueba de software. No representa una evaluación clínica."}
            </Notice>
          )}
          <h1 className="serif case-title">{currentCase.title}</h1>
          <div className="case-meta">
            {competencyNames[question.competency] || question.competency} ·{" "}
            {
              (
                {
                  basic: "Básica",
                  intermediate: "Intermedia",
                  advanced: "Avanzada",
                } as Record<string, string>
              )[question.difficulty]
            }
          </div>
          <h2>Situación disponible</h2>
          <div className="clinical-box">
            <p>{clinicalText(currentCase.initial_context)}</p>
            {currentCase.context_blocks.map((block) => (
              <p key={block.id}>{clinicalText(block.text)}</p>
            ))}
          </div>
          {question.guidance?.length ? (
            <section
              className="notice"
              aria-label="Orientación para esta pregunta"
            >
              <strong>Orientación para esta pregunta</strong>
              <ul>
                {question.guidance.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <fieldset className="options">
            <legend className="question">{question.prompt}</legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`option ${(pending?.option || selected) === option.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="option"
                  value={option.id}
                  checked={(pending?.option || selected) === option.id}
                  onChange={() => {
                    setSelected(option.id);
                    setError("");
                  }}
                  disabled={busy || !!pending}
                />
                <span className="letter">{option.id}</span>
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>
          {error && (
            <Failure
              message={error}
              retry={
                !pending && presentedId !== question.id
                  ? resource.retry
                  : undefined
              }
            />
          )}{" "}
          {feedback ? (
            <>
              <div
                className={`feedback ${feedback.correct ? "correct" : "wrong"}`}
                role="status"
              >
                <h2>
                  {feedback.correct ? "Correcto" : "Revisemos esta decisión"}
                </h2>
                <p>{feedback.explanation}</p>
                <p>{feedback.feedback}</p>
                {feedback.source && (
                  <details>
                    <summary>Fuente del contenido</summary>
                    <p>{feedback.source}</p>
                  </details>
                )}
                <small>+{feedback.exp_gained} EXP</small>
              </div>
              <button className="btn btn-primary" onClick={next}>
                {feedback.session.status === "completed"
                  ? "Ver resultado →"
                  : "Continuar →"}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                disabled={
                  busy ||
                  (!pending && (!selected || presentedId !== question.id))
                }
                onClick={() => void answer()}
              >
                {busy
                  ? "Guardando respuesta…"
                  : pending
                    ? "Reintentar la misma respuesta"
                    : "Comprobar respuesta"}
              </button>
              {pending && (
                <p className="muted">
                  Conservamos tu respuesta para reintentar sin duplicarla.
                </p>
              )}
            </>
          )}
        </section>
        <aside className="panel case-side">
          <h2>Tu práctica</h2>
          <div className="side-stat">
            <small>Preguntas respondidas</small>
            <strong>
              {feedback ? feedback.session.answered : session.answered} /{" "}
              {session.total_questions}
            </strong>
          </div>
          <div className="side-stat">
            <small>EXP de esta práctica</small>
            <strong>{feedback ? feedback.session.exp : session.exp}</strong>
          </div>
          <RecommendationStatus
            recommendation={
              feedback?.session.recommendation || session.recommendation
            }
          />
          <h3>Resultado de esta sesión</h3>
          <Competencies
            axes={
              feedback?.session.session_metrics || session.session_metrics || []
            }
          />
        </aside>
      </div>
    </>
  );
}

export function SummaryView() {
  const { sessionId } = useParams();
  const resource = useResource(
    async (signal) => {
      const [summary, session] = await Promise.all([
        api<Summary>(`/sessions/${sessionId}/summary`, { signal }),
        api<Practice>(`/sessions/${sessionId}`, { signal }),
      ]);
      return { summary, session };
    },
    [sessionId],
  );
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <Failure message={resource.error} retry={resource.retry} />;
  const { summary, session } = resource.data!;
  const cancelled = summary.status === "cancelled";
  if (summary.status === "active")
    return <Navigate to={`/app/sesiones/${sessionId}`} replace />;
  return (
    <>
      <div className="welcome">
        <div className="eyebrow">
          {cancelled ? "Práctica cancelada" : "Práctica completada"}
        </div>
        <h1 className="serif">
          {cancelled
            ? "Tu historial está conservado."
            : "Un paso más en tu recorrido."}
        </h1>
        <p className="muted">
          {cancelled
            ? "Esta práctica se cerró al retirar los casos de prueba. Puedes elegir un tema del banco del proyecto."
            : "Revisa tus resultados antes de continuar."}
        </p>
      </div>
      <div className="stats">
        <div className="stat">
          <small>Decisiones correctas</small>
          <strong>
            {summary.correct} / {summary.answers}
          </strong>
        </div>
        <div className="stat">
          <small>Por revisar</small>
          <strong>{summary.incorrect}</strong>
        </div>
        <div className="stat">
          <small>EXP ganada</small>
          <strong>{summary.exp_gained}</strong>
        </div>
      </div>
      <div className="grid2">
        <section className="panel">
          <h2>Perlas de cierre</h2>
          {summary.completed_cases.flatMap((c) => c.pearls).length ? (
            summary.completed_cases
              .flatMap((c) => c.pearls)
              .map((pearl, i) => (
                <p className="pearl" key={i}>
                  {pearl}
                </p>
              ))
          ) : (
            <p className="muted">
              No hay perlas disponibles para este contenido.
            </p>
          )}
          <Notice>
            {summary.content_kind === "clinical_demo"
              ? "Resultado de un caso del banco del proyecto. La revisión clínica del contenido sigue pendiente."
              : "Este resultado corresponde al banco de pruebas de integración."}
          </Notice>
        </section>
        <section className="panel">
          <h2>Resultado de esta sesión por competencia</h2>
          <Competencies axes={summary.competencies} />
        </section>
      </div>
      {summary.case_results?.map((c) => (
        <section className="panel" key={c.case_id}>
          <h2>{c.title}</h2>
          <Competencies axes={c.competencies} />
        </section>
      ))}
      <Link
        className="btn btn-primary"
        to={cancelled ? "/app/mundos" : `/app/rutas/${session.route_id}`}
      >
        {cancelled
          ? "Elegir una práctica real →"
          : "Ir a mi siguiente práctica →"}
      </Link>
    </>
  );
}
