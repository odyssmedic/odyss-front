import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { all, api } from "./api";
import { useAuth } from "./auth";
import {
  Competencies,
  Failure,
  Loading,
  Notice,
  competencyNames,
  useResource,
} from "./components";
import type { Axis, Item, LearningRoute, Practice } from "./types";

type Enrollment = { discipline_id: string; specialty_ids: string[] };
type Preferences = {
  profile: {
    university: string;
    career: string;
    training_goal: string;
    entry_mode: string;
  };
  enrollments: Enrollment[];
  data_origin: string;
};
type Proposal = {
  id: string;
  case_count: number;
  total_questions: number;
  requested_questions: number;
  additional_questions: number;
  coverage: Record<string, number>;
  missing: Record<string, number>;
};
export function PreferenceFields({
  world,
  setWorld,
  specialties,
  setSpecialties,
}: {
  world: string;
  setWorld: (v: string) => void;
  specialties: string[];
  setSpecialties: (v: string[]) => void;
}) {
  const worlds = useResource(
    (signal) => all<Item>("/public/disciplines", signal),
    [],
  );
  const specs = useResource(
    (signal) =>
      world
        ? all<Item>(`/public/specialties?discipline_id=${world}`, signal)
        : Promise.resolve([]),
    [world],
  );
  return (
    <fieldset className="preference-fields">
      <legend>Preferencias iniciales</legend>
      {worlds.error && <Failure message={worlds.error} retry={worlds.retry} />}
      <label className="field">
        Mundo clínico
        <select
          aria-label="Mundo clínico"
          name="discipline_id"
          required
          value={world}
          onChange={(e) => {
            setWorld(e.target.value);
            setSpecialties([]);
          }}
        >
          <option value="">Selecciona un mundo</option>
          {worlds.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Especialidades de interés</legend>
        {specs.loading ? (
          <Loading />
        ) : specs.error ? (
          <Failure message={specs.error} retry={specs.retry} />
        ) : !specs.data?.length ? (
          <p className="muted">
            {world
              ? "Este mundo aún no tiene especialidades disponibles."
              : "Selecciona primero un mundo."}
          </p>
        ) : (
          specs.data.map((s) => (
            <label className="check-label" key={s.id}>
              <input
                type="checkbox"
                name="specialty_ids"
                value={s.id}
                checked={specialties.includes(s.id)}
                onChange={(e) =>
                  setSpecialties(
                    e.target.checked
                      ? [...specialties, s.id]
                      : specialties.filter((id) => id !== s.id),
                  )
                }
              />
              {s.name}
            </label>
          ))
        )}
      </fieldset>
    </fieldset>
  );
}
export function Journey() {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const resource = useResource(
    async (signal) => {
      const [prefs, worlds, routes] = await Promise.all([
        api<Preferences>("/me/preferences", { signal }),
        all<Item>("/disciplines", signal),
        all<LearningRoute>("/routes", signal),
      ]);
      return { prefs, worlds, routes };
    },
    [user!.student.id],
  );
  const [adding, setAdding] = useState(false),
    [world, setWorld] = useState(""),
    [specialties, setSpecialties] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function enroll(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!specialties.length) {
      setError("Elige al menos una especialidad.");
      return;
    }
    setBusy(true);
    try {
      await api("/me/enrollments", {
        method: "POST",
        body: { discipline_id: world, specialty_ids: specialties },
      });
      setAdding(false);
      resource.retry();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <Failure message={resource.error} retry={resource.retry} />;
  const { prefs, worlds, routes } = resource.data!;
  const activeWorlds = [
    ...new Set([
      ...prefs.enrollments.map((e) => e.discipline_id),
      ...routes.filter((r) => !r.archived).map((r) => r.discipline_id),
    ]),
  ];
  return (
    <>
      <div className="welcome">
        <div className="eyebrow">Tu recorrido</div>
        <h1 className="serif">Mi ruta</h1>
        <p>Mundo → especialidades → temas → casos y preguntas.</p>
      </div>
      <div className="hero-actions">
        <button className="btn btn-primary" onClick={() => setAdding(!adding)}>
          Añadir o actualizar un mundo
        </button>
        <Link className="btn btn-soft" to="/app/diagnostico">
          Explorar mi ruta con un diagnóstico
        </Link>
      </div>
      {error && <Failure message={error} />}{" "}
      {adding && (
        <form className="panel" onSubmit={enroll}>
          <PreferenceFields
            {...{ world, setWorld, specialties, setSpecialties }}
          />
          <button className="btn btn-primary" disabled={busy}>
            Guardar inscripción
          </button>
        </form>
      )}
      {!activeWorlds.length && (
        <Notice>
          Inscríbete en un mundo para explorar sus especialidades y crear tu
          primera práctica.
        </Notice>
      )}
      {activeWorlds.map((id) => (
        <section className="panel" key={id}>
          <h2>
            {worlds.find((w) => w.id === id)?.name ||
              "Mundo no disponible en el catálogo"}
          </h2>
          <WorldTree
            discipline={id}
            routes={routes}
            onRoute={(id) => navigate(`/app/rutas/${id}${location.search}`)}
          />
        </section>
      ))}
    </>
  );
}
function WorldTree({
  discipline,
  routes,
  onRoute,
}: {
  discipline: string;
  routes: LearningRoute[];
  onRoute: (id: string) => void;
}) {
  const specs = useResource(
    (signal) => all<Item>(`/specialties?discipline_id=${discipline}`, signal),
    [discipline],
  );
  if (specs.loading) return <Loading />;
  if (specs.error) return <Failure message={specs.error} retry={specs.retry} />;
  return (
    <>
      {!specs.data?.length && <p>Aún no hay especialidades disponibles.</p>}
      {specs.data?.map((s) => (
        <details className="catalog-branch" key={s.id}>
          <summary>{s.name}</summary>
          <TopicTree
            discipline={discipline}
            specialty={s}
            routes={routes}
            onRoute={onRoute}
          />
        </details>
      ))}
    </>
  );
}
function TopicTree({
  discipline,
  specialty,
  routes,
  onRoute,
}: {
  discipline: string;
  specialty: Item;
  routes: LearningRoute[];
  onRoute: (id: string) => void;
}) {
  const topics = useResource(
    (signal) => all<Item>(`/topics?specialty_id=${specialty.id}`, signal),
    [specialty.id],
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function choose(t: Item) {
    const existing = routes.find(
      (r) =>
        !r.archived &&
        r.discipline_id === discipline &&
        r.specialty_id === specialty.id &&
        r.topic_id === t.id,
    );
    if (existing) {
      onRoute(existing.id);
      return;
    }
    setBusy(t.id);
    setError("");
    try {
      const r = await api<LearningRoute>("/routes", {
        method: "POST",
        body: {
          name: `${specialty.name} · ${t.name}`,
          mode: "from_zero",
          discipline_id: discipline,
          specialty_id: specialty.id,
          topic_id: t.id,
        },
      });
      onRoute(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (topics.loading) return <Loading />;
  if (topics.error)
    return <Failure message={topics.error} retry={topics.retry} />;
  return (
    <>
      {error && <Failure message={error} />}{" "}
      {!topics.data?.length && <p>Aún no hay temas disponibles.</p>}{" "}
      {topics.data?.map((t) => (
        <div className="route-item" key={t.id}>
          <div className="grow">
            <strong>{t.name}</strong>
            <p className="muted">
              {t.practice?.eligible_cases || 0} casos disponibles
            </p>
          </div>
          <button
            className="btn btn-soft"
            disabled={!!busy || !t.practice?.eligible_cases}
            onClick={() => void choose(t)}
          >
            {t.practice?.eligible_cases
              ? "Configurar práctica"
              : "Aún no disponible"}
          </button>
        </div>
      ))}
    </>
  );
}
export function SessionSetup({
  routeId,
  diagnostic,
}: {
  routeId?: string;
  diagnostic?: { discipline_id: string; specialty_ids: string[] };
}) {
  const [cases, setCases] = useState(1),
    [mode, setMode] = useState("all"),
    [questions, setQuestions] = useState(5),
    [priorities, setPriorities] = useState<string[]>(() => {
      const c = new URLSearchParams(window.location.search).get("competency");
      return c && competencyNames[c] ? [c] : [];
    }),
    [advanced, setAdvanced] = useState(false),
    [quotas, setQuotas] = useState<Record<string, number>>({}),
    [proposal, setProposal] = useState<Proposal>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function propose(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setProposal(
        await api<Proposal>("/session-proposals", {
          method: "POST",
          body: diagnostic
            ? { kind: "diagnostic", ...diagnostic }
            : {
                kind: "practice",
                route_id: routeId,
                case_count: cases,
                question_mode: advanced ? "quotas" : mode,
                questions,
                priorities,
                quotas,
              },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const s = await api<Practice>(`/session-proposals/${proposal.id}/start`, {
        method: "POST",
      });
      navigate(`/app/sesiones/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (proposal)
    return (
      <section className="session-proposal">
        <h3>Tu propuesta de {diagnostic ? "diagnóstico" : "práctica"}</h3>
        <p>
          <strong>
            {proposal.case_count} casos · {proposal.total_questions} preguntas
          </strong>
        </p>
        <p>
          {proposal.requested_questions} preguntas objetivo ·{" "}
          {proposal.additional_questions} adicionales por secuencia clínica.
        </p>
        <ul>
          {Object.entries(competencyNames).map(([key, label]) => (
            <li key={key}>
              {label}: {proposal.coverage[key] || 0} preguntas
              {proposal.missing[key]
                ? ` · faltan ${proposal.missing[key]} preguntas objetivo`
                : ""}
            </li>
          ))}
        </ul>
        {Object.keys(proposal.missing).length > 0 && (
          <Notice>
            Cobertura parcial: el banco disponible no permite completar todos
            los objetivos del diagnóstico.
          </Notice>
        )}
        <Notice>
          El número de respuestas aporta evidencia; no garantiza precisión del
          modelo ni certifica dominio.
        </Notice>
        {error && <Failure message={error} />}
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void start()}
          >
            Confirmar y comenzar
          </button>
          <button
            className="btn btn-soft"
            disabled={busy}
            onClick={() => setProposal(undefined)}
          >
            Ajustar configuración
          </button>
        </div>
      </section>
    );
  return (
    <form onSubmit={propose} onChange={() => setProposal(undefined)}>
      {diagnostic ? (
        <p>
          Buscaremos dos preguntas objetivo por competencia en las
          especialidades seleccionadas, incluyendo sus prerrequisitos. Podrás
          revisar la cobertura antes de comenzar.
        </p>
      ) : (
        <>
          <div className="setup-grid">
            <label className="field">
              Número de casos
              <input
                type="number"
                min={1}
                max={20}
                value={cases}
                onChange={(e) => setCases(Number(e.target.value))}
                required
              />
            </label>
            {!advanced && (
              <>
                <label className="field">
                  Preguntas
                  <select
                    aria-label="Preguntas"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="all">
                      Todas las disponibles de cada caso
                    </option>
                    <option value="total">Total de la sesión</option>
                    <option value="per_case">Por caso</option>
                  </select>
                </label>
                {mode !== "all" && (
                  <label className="field">
                    Cantidad de preguntas
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={questions}
                      onChange={(e) => setQuestions(Number(e.target.value))}
                    />
                  </label>
                )}
              </>
            )}
          </div>
          <fieldset>
            <legend>Prioridad de refuerzo (opcional)</legend>
            {Object.entries(competencyNames).map(([key, label]) => (
              <label className="check-label" key={key}>
                <input
                  type="checkbox"
                  checked={priorities.includes(key)}
                  onChange={(e) =>
                    setPriorities(
                      e.target.checked
                        ? [...priorities, key]
                        : priorities.filter((x) => x !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="check-label">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />
            Configuración avanzada: cuotas por competencia
          </label>
          {advanced && (
            <div className="setup-grid">
              {Object.entries(competencyNames).map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={quotas[key] || 0}
                    onChange={(e) =>
                      setQuotas({ ...quotas, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {error && <Failure message={error} />}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Calculando…" : "Calcular propuesta"}
      </button>
    </form>
  );
}
export function Diagnostic() {
  const prefs = useResource(
    (signal) => api<Preferences>("/me/preferences", { signal }),
    [],
  );
  const [world, setWorld] = useState(""),
    [specialties, setSpecialties] = useState<string[]>([]),
    [ready, setReady] = useState(false);
  if (prefs.loading) return <Loading />;
  if (prefs.error) return <Failure message={prefs.error} retry={prefs.retry} />;
  const first = prefs.data!.enrollments[0];
  const d = world || first?.discipline_id || "";
  const specs = world ? specialties : first?.specialty_ids || [];
  return (
    <>
      <h1 className="serif">Explora tu ruta: diagnóstico inicial</h1>
      <section className="panel">
        <PreferenceFields
          world={d}
          setWorld={(v) => {
            setWorld(v);
            setSpecialties([]);
            setReady(false);
          }}
          specialties={specs}
          setSpecialties={(v) => {
            setWorld(d);
            setSpecialties(v);
            setReady(false);
          }}
        />
        {!ready ? (
          <button
            className="btn btn-primary"
            disabled={!d || !specs.length}
            onClick={() => setReady(true)}
          >
            Usar estas preferencias
          </button>
        ) : (
          <SessionSetup
            key={d + specs.join()}
            diagnostic={{ discipline_id: d, specialty_ids: specs }}
          />
        )}
      </section>
    </>
  );
}
export function Progress() {
  const { user } = useAuth();
  const userID = user!.student.id;
  const [world, setWorld] = useState(""),
    [specialty, setSpecialty] = useState(""),
    [topic, setTopic] = useState("");
  const worlds = useResource((signal) => all<Item>("/disciplines", signal), []);
  const specs = useResource(
    (signal) =>
      world
        ? all<Item>(`/specialties?discipline_id=${world}`, signal)
        : Promise.resolve([]),
    [world],
  );
  const topics = useResource(
    (signal) =>
      specialty
        ? all<Item>(`/topics?specialty_id=${specialty}`, signal)
        : Promise.resolve([]),
    [specialty],
  );
  const data = useResource(
    (signal) =>
      api<{ axes: Axis[]; answers: number; note: string }>(
        `/me/progress?discipline_id=${world}&specialty_id=${specialty}&topic_id=${topic}`,
        { signal },
      ),
    [world, specialty, topic],
  );
  const mastery = useResource(
    (signal) =>
      topic
        ? api<{ axes: Axis[] }>(
            `/students/${userID}/competencies?topic_id=${topic}`,
            { signal },
          )
        : Promise.resolve(null),
    [topic],
  );
  return (
    <>
      <h1 className="serif">Mi progreso</h1>
      <section className="panel">
        <div className="setup-grid">
          {[
            {
              label: "Mundo",
              value: world,
              items: worlds.data,
              change: (v: string) => {
                setWorld(v);
                setSpecialty("");
                setTopic("");
              },
            },
            {
              label: "Especialidad",
              value: specialty,
              items: specs.data,
              change: (v: string) => {
                setSpecialty(v);
                setTopic("");
              },
            },
            {
              label: "Tema",
              value: topic,
              items: topics.data,
              change: setTopic,
            },
          ].map((f) => (
            <label className="field" key={f.label}>
              {f.label}
              <select
                value={f.value}
                onChange={(e) => f.change(e.target.value)}
              >
                <option value="">Todos</option>
                {f.items?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {[worlds, specs, topics].map((r, i) =>
          r.error ? (
            <Failure key={i} message={r.error} retry={r.retry} />
          ) : null,
        )}
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <Failure message={data.error} retry={data.retry} />
        ) : (
          <>
            <h2>Desempeño acumulado · {data.data!.answers} respuestas</h2>
            <Competencies axes={data.data!.axes} />
            <Notice>{data.data!.note}</Notice>
            <h3>Refuerzo sugerido</h3>
            {!data.data!.axes.some(
              (a) => a.answers > 0 && a.correct! < a.answers,
            ) && (
              <p>
                Aún no hay errores registrados en esta selección. Puedes
                explorar otras competencias.
              </p>
            )}
            {data
              .data!.axes.filter((a) => a.answers > 0 && a.correct! < a.answers)
              .sort((a, b) => (a.value ?? 100) - (b.value ?? 100))
              .map((a) => (
                <p key={a.competency}>
                  Te recomendamos reforzar {competencyNames[a.competency]}:{" "}
                  {a.correct} aciertos de {a.answers} respuestas (
                  {Math.round(a.value!)}%).{" "}
                  {a.answers < 5
                    ? "Evidencia inicial; sigue practicando."
                    : "Este resultado describe tu historial, no certifica dominio."}{" "}
                  <Link to={`/app/mi-ruta?competency=${a.competency}`}>
                    Elegir práctica
                  </Link>
                </p>
              ))}
          </>
        )}
        {topic &&
          (mastery.loading ? (
            <Loading />
          ) : mastery.error ? (
            <Failure message={mastery.error} retry={mastery.retry} />
          ) : (
            mastery.data && (
              <>
                <h3>Dominio adaptativo del tema</h3>
                <Competencies axes={mastery.data.axes} />
                <p className="muted">
                  Estimación histórica del motor, distinta del porcentaje de
                  aciertos.
                </p>
              </>
            )
          ))}
      </section>
    </>
  );
}

export function DemoNotice() {
  const state = useResource(
    (signal) => api<Preferences>("/me/preferences", { signal }),
    [],
  );
  return state.data?.data_origin === "stakeholder_demo" ? (
    <Notice>
      Cuenta de demostración · historial simulado para presentación. Sus
      respuestas se excluyen del entrenamiento con datos reales.
    </Notice>
  ) : null;
}
