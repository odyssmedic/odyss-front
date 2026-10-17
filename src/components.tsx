import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  Axis,
  SessionRow,
  PracticeAvailability,
  Recommendation,
} from "./types";
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark" aria-hidden="true">
        <span className="pulse" />
      </span>
      OdyssMedic
    </Link>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
export function Failure({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="btn btn-soft" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <p className="loading" role="status">
      Cargando tu recorrido…
    </p>
  );
}
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setData(undefined);
    load(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [...deps, revision]);
  return { data, error, loading, retry: () => setRevision((x) => x + 1) };
}
export const competencyNames: Record<string, string> = {
  initial_assessment: "Evaluación inicial",
  diagnosis: "Diagnóstico",
  tests_reasoning: "Interpretación de pruebas",
  treatment_dosing: "Tratamiento y dosificación",
  safety_adverse_effects: "Seguridad y efectos adversos",
};
export function Competencies({ axes }: { axes: Axis[] }) {
  return (
    <div className="axes">
      {axes.map((axis) => (
        <div key={axis.competency}>
          <div className="axis-label">
            <strong>
              {competencyNames[axis.competency] || axis.competency}
            </strong>
            <span>
              {axis.value === null
                ? "Sin evidencia"
                : `${Math.round(axis.value)}%`}
            </span>
          </div>
          <progress
            max={100}
            value={axis.value ?? 0}
            aria-label={competencyNames[axis.competency]}
          />
          <small className="muted">
            {axis.correct !== undefined ? `${axis.correct} aciertos de ` : ""}
            {axis.answers} respuestas ·{" "}
            {axis.answers < 5 ? "Evidencia inicial" : "Desempeño observado"}
          </small>
        </div>
      ))}
    </div>
  );
}
export function History({ sessions }: { sessions: SessionRow[] }) {
  return (
    <div className="route-list">
      {sessions.length === 0 ? (
        <p className="muted">Todavía no has iniciado una práctica.</p>
      ) : (
        sessions.map((s, i) => (
          <div className="route-item" key={s.id}>
            <span className="route-num">{sessions.length - i}</span>
            <div className="grow">
              <strong>
                {s.status === "active"
                  ? "Práctica en curso"
                  : s.status === "cancelled"
                    ? "Práctica cancelada"
                    : "Práctica completada"}
              </strong>
              <p className="muted">
                {s.answered} de {s.total_questions} preguntas · {s.exp} EXP
              </p>
            </div>
            <Link
              className="btn btn-soft"
              to={`/app/sesiones/${s.id}${s.status !== "active" ? "/resumen" : ""}`}
            >
              {s.status === "active" ? "Continuar" : "Ver resultado"}
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

export function availabilityMessage(availability: PracticeAvailability) {
  if (availability.published_cases === 0)
    return "Este tema aún no tiene casos publicados para practicar. Su contenido está pendiente de preparación y publicación.";
  if (availability.max_questions_per_case === 0)
    return "Este tema aún no tiene una secuencia de preguntas disponible para practicar.";
  return `Este tema aún no tiene un caso con una secuencia de preguntas disponible.`;
}
export function UnavailablePractice({
  availability,
}: {
  availability: PracticeAvailability;
}) {
  return (
    <Notice>
      <p>{availabilityMessage(availability)}</p>
      <p>Elige otro tema con casos disponibles en el catálogo.</p>
    </Notice>
  );
}

export function RecommendationStatus({
  recommendation,
}: {
  recommendation: Recommendation | null;
}) {
  const evidence = recommendation?.neural;
  if (!evidence)
    return <p className="muted">Selección por reglas de aprendizaje.</p>;
  const labels: Record<string, string> = {
    cold_start: "Reuniendo respuestas iniciales",
    used: "LSTM activa",
    fallback: "Selección por reglas: LSTM no disponible",
  };
  return (
    <div className="notice">
      <strong>{labels[evidence.status] || "Recomendación adaptativa"}</strong>
      {evidence.model_version && (
        <details>
          <summary>Detalles del modelo</summary>
          <p className="muted">{evidence.model_version}</p>
        </details>
      )}
      {evidence.training_source === "synthetic_demo" && (
        <p>
          LSTM experimental: modelo de demostración entrenado con estudiantes
          simulados. Sus predicciones no son tu calificación.
        </p>
      )}
      {recommendation?.candidate_count === 1 && (
        <p>
          Esta pregunta sigue el orden del caso; no hay alternativas elegibles
          en este paso.
        </p>
      )}
      {recommendation?.case_selection &&
        recommendation.case_selection.candidate_count > 1 && (
          <p>
            El siguiente caso se elige entre{" "}
            {recommendation.case_selection.candidate_count} casos disponibles.
          </p>
        )}
    </div>
  );
}
