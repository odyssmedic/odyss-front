import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
const password = "Browser-test-password-123";
async function register(page: Page, email: string) {
  await page.goto("/registro");
  await page
    .getByLabel("Mundo clínico", { exact: true })
    .selectOption({ label: "Medicina interna" });
  await page
    .getByRole("checkbox", { name: "Endocrinología", exact: true })
    .check();
  await page
    .getByLabel("Objetivo de entrenamiento")
    .fill("Reforzar razonamiento clínico");
  await page
    .getByLabel("Universidad", { exact: true })
    .fill("Universidad de prueba");
  await page.getByLabel("Carrera", { exact: true }).fill("Medicina");
  await page.getByLabel("Nombre", { exact: true }).fill("Estudiante de prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cada decisión cuenta." }),
  ).toBeVisible();
}
async function createRoute(
  page: Page,
  topic = "Estado hiperosmolar hiperglucémico",
) {
  await page.getByRole("link", { name: "Mi ruta", exact: true }).click();
  await page.getByText("Endocrinología", { exact: true }).click();
  const row = page
    .locator(".route-item")
    .filter({ has: page.getByText(topic, { exact: true }) });
  await row.getByRole("button", { name: "Configurar práctica" }).click();
  await expect(
    page.getByRole("button", { name: "Calcular propuesta" }),
  ).toBeVisible();
}
async function startPractice(page: Page) {
  await page.getByRole("button", { name: "Calcular propuesta" }).click();
  await page.getByRole("button", { name: "Confirmar y comenzar" }).click();
}

test("registro, práctica con reintento y recarga, resumen y aislamiento", async ({
  page,
  browser,
}) => {
  const email = `browser-${Date.now()}@example.test`;
  await register(page, email);
  await createRoute(page);
  const routeURL = page.url();
  await startPractice(page);
  await expect(page.getByRole("radio")).toHaveCount(4);
  const sessionURL = page.url();
  await page.reload();
  await expect(page.getByRole("radio")).toHaveCount(4);
  // Lose a committed HTTP response: the UI must retry the original key and body.
  let intercepted = false;
  await page.route("**/api/v1/sessions/*/answers", async (route) => {
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await expect(page.locator(".case-title")).not.toContainText(
    "Fixture educativo",
  );
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("alert")).toContainText("No hay conexión");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reintentar la misma respuesta" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reintentar la misma respuesta" })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar →", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continuar →", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  for (let i = 1; i < 5; i++) {
    await expect(
      page.getByText(`Pregunta ${i + 1} de 5`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Comprobar respuesta" }).click();
    await page
      .getByRole("button", {
        name: i === 4 ? "Ver resultado →" : "Continuar →",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Un paso más en tu recorrido." }),
  ).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("/ 5");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Perlas de cierre" }),
  ).toBeVisible();
  await page.goto(routeURL);
  await expect(
    page.getByRole("button", { name: "Calcular propuesta" }),
  ).toBeVisible();
  const other = await browser.newContext();
  const bob = await other.newPage();
  await register(bob, `other-${Date.now()}@example.test`);
  await expect(
    bob.locator(".stat").filter({ hasText: "EXP acumulada" }),
  ).toContainText("0");
  await bob.goto(sessionURL);
  await expect(bob.getByRole("alert")).toContainText(
    "Recurso de otro estudiante",
  );
  await other.close();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto(sessionURL);
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cada decisión cuenta." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver resultado" })).toBeVisible();
});

test("recuperación por correo, nueva contraseña y enlace de un uso", async ({
  page,
  request,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  await register(page, email);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(
    page.getByRole("heading", { name: "Recupera tu acceso." }),
  ).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta");
  const mailbox = process.env.MAILPIT_URL || "http://127.0.0.1:8025";
  let messageId = "";
  await expect
    .poll(
      async () => {
        const res = await request.get(`${mailbox}/api/v1/messages`);
        const data = await res.json();
        const message = data.messages.find(
          (m: { To: { Address: string }[]; ID: string }) =>
            m.To.some((t) => t.Address === email),
        );
        messageId = message?.ID || "";
        return !!messageId;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  const response = await request.get(`${mailbox}/api/v1/message/${messageId}`);
  const mail = await response.json();
  const token = mail.Text.match(/#token=([\w-]+)/)[1];
  await page.goto(`/restablecer#token=${token}`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("New-browser-password-456");
  await page
    .getByLabel("Confirmar contraseña")
    .fill("New-browser-password-456");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Contraseña actualizada",
  );
  await page.getByRole("link", { name: "Ir a ingresar" }).click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("New-browser-password-456");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cada decisión cuenta." }),
  ).toBeVisible();
  await page.goto(`/restablecer#token=${token}`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Another-password-789");
  await page.getByLabel("Confirmar contraseña").fill("Another-password-789");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("alert")).toContainText("ya fue utilizado");
});

test("móvil, navegación y error recuperable de catálogo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, `mobile-${Date.now()}@example.test`);
  await page.route("**/api/v1/disciplines*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "content_unavailable",
          message: "El catálogo no está disponible",
        },
      }),
    }),
  );
  await page.goto("/app/mi-ruta");
  await expect(page.getByRole("alert")).toContainText(
    "El catálogo no está disponible",
  );
  await page.unroute("**/api/v1/disciplines*");
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(
    page.getByRole("heading", { name: "Mi ruta", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-journey.png",
    fullPage: true,
  });
});
test("tema sin contenido no permite configurar práctica", async ({ page }) => {
  await register(page, `pending-${Date.now()}@example.test`);
  await page.getByRole("link", { name: "Mi ruta", exact: true }).click();
  await page.getByText("Endocrinología", { exact: true }).click();
  const row = page.locator(".route-item").filter({
    has: page.getByText("Tema pendiente de revisión", { exact: true }),
  });
  await expect(
    row.getByRole("button", { name: "Aún no disponible" }),
  ).toBeDisabled();
});

test("Aldosteronismo: cuatro preguntas reales, contexto progresivo y LSTM", async ({
  page,
}) => {
  await register(page, `clinical-${Date.now()}@example.test`);
  await createRoute(page, "Aldosteronismo primario");
  await startPractice(page);
  await expect(
    page.getByText("Pregunta 1 de 4", { exact: true }),
  ).toBeVisible();
  const questionResponse = await page.request.get(
    `/api/v1/sessions/${page.url().split("/").at(-1)}`,
  );
  const questionState = await questionResponse.json();
  expect(questionState.current_question.guidance).toHaveLength(1);
  await expect(
    page
      .getByRole("region", { name: "Orientación para esta pregunta" })
      .getByRole("listitem"),
  ).toHaveCount(1);
  expect(
    questionState.current_case.context_blocks.every(
      (b: Record<string, unknown>) => !("after_question_ids" in b),
    ),
  ).toBe(true);
  expect(questionState.current_question).not.toHaveProperty(
    "correct_option_id",
  );
  expect(questionState.current_question).not.toHaveProperty("explanation");

  await expect(
    page.getByText("Caso del banco clínico del proyecto", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".clinical-box")).not.toContainText(
    "Aldosterona por inmunoensayo: 14",
  );
  for (let i = 0; i < 4; i++) {
    await expect(
      page.getByText(`Pregunta ${i + 1} de 4`, { exact: true }),
    ).toBeVisible();
    if (i === 1)
      await expect(page.locator(".clinical-box")).not.toContainText(
        "Aldosterona por inmunoensayo: 14",
      );
    if (i === 2) {
      await expect(page.locator(".clinical-box")).toContainText(
        "Aldosterona por inmunoensayo: 14",
      );
      await expect(page.locator(".clinical-box")).toContainText("≥10");
      if (process.env.E2E_RECOMMENDER_MODE === "hybrid_lstm")
        await expect(
          page.getByText("LSTM activa", { exact: true }),
        ).toBeVisible();
      await page.screenshot({
        path: "test-results/clinical-aldosteronismo.png",
        fullPage: true,
      });
    }
    const live = await (
      await page.request.get(`/api/v1/sessions/${page.url().split("/").at(-1)}`)
    ).json();
    const expectedGuidance = { basic: 2, intermediate: 1, advanced: 0 }[
      live.current_question.difficulty as "basic" | "intermediate" | "advanced"
    ];
    expect(live.current_question.guidance).toHaveLength(expectedGuidance);
    if (expectedGuidance)
      await expect(
        page
          .getByRole("region", { name: "Orientación para esta pregunta" })
          .getByRole("listitem"),
      ).toHaveCount(expectedGuidance);
    else
      await expect(
        page.getByRole("region", { name: "Orientación para esta pregunta" }),
      ).toHaveCount(0);
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Comprobar respuesta" }).click();
    await expect(
      page.getByText("Fuente del contenido", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 3 ? "Ver resultado →" : "Continuar →",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Un paso más en tu recorrido." }),
  ).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("/ 4");
  await page.reload();
  await expect(page.locator(".stat").first()).toContainText("/ 4");
});

test("sesión cancelada conserva historial y retira feedback local antes de mostrar preguntas", async ({
  page,
}) => {
  const dsn = process.env.E2E_LEARNING_DATABASE_URL;
  test.skip(
    !dsn || !new URL(dsn).pathname.startsWith("/odyss_e2e_learning_"),
    "Requiere la base desechable del script E2E",
  );
  await register(page, `cancelled-${Date.now()}@example.test`);
  await createRoute(page);
  await startPractice(page);
  await expect(page.getByRole("radio")).toHaveCount(4);
  const sessionId = page.url().split("/").at(-1)!;
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(
    page.getByRole("button", { name: "Continuar →", exact: true }),
  ).toBeVisible();
  const storageKey = await page.evaluate(() =>
    Object.keys(sessionStorage).find((k) => k.startsWith("odyss:"))!,
  );
  expect(storageKey).toBeTruthy();
  await page.evaluate(() => sessionStorage.setItem("unrelated-state", "keep"));
  // Emulate the transition against real PostgreSQL, confined to this disposable session.
  execFileSync("psql", [
    dsn!,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `UPDATE sessions SET status='cancelled',active_case_id=NULL,current_question_id=NULL WHERE id='${sessionId}'`,
  ]);
  let shownQuestion = false;
  await page.addInitScript(() => {
    const observe = () => {
      new MutationObserver(() => {
        if (document.querySelector(".case-title, input[type=radio]"))
          (
            window as unknown as { showedCancelledQuestion: boolean }
          ).showedCancelledQuestion = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) observe();
    else document.addEventListener("DOMContentLoaded", observe, { once: true });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tu historial está conservado." }),
  ).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("/ 1");
  await expect(page.getByRole("radio")).toHaveCount(0);
  shownQuestion = await page.evaluate(
    () =>
      !!(window as unknown as { showedCancelledQuestion: boolean })
        .showedCancelledQuestion,
  );
  expect(shownQuestion).toBe(false);
  expect(
    await page.evaluate((k) => sessionStorage.getItem(k), storageKey),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("unrelated-state")),
  ).toBe("keep");
  await page.goto("/app");
  await expect(
    page.getByText("Práctica cancelada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar práctica →" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Ver resultado" }).click();
  await page.getByRole("link", { name: "Elegir una práctica real →" }).click();
  await expect(
    page.getByRole("heading", { name: "Mi ruta", exact: true }),
  ).toBeVisible();
});

test("cuotas avanzadas, propuesta inviable y progreso sin evidencia", async ({
  page,
}) => {
  await register(page, `quotas-${Date.now()}@example.test`);
  await page.getByRole("link", { name: "Mi progreso", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Desempeño acumulado · 0 respuestas/ }),
  ).toBeVisible();
  await createRoute(page);
  await page.getByLabel("Preguntas", { exact: true }).selectOption("per_case");
  await page.getByLabel("Cantidad de preguntas", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Calcular propuesta" }).click();
  await expect(page.getByRole("alert")).toContainText("Solo hay 0 casos");
  await page.getByRole("checkbox", { name: /Configuración avanzada/ }).check();
  await page
    .getByRole("spinbutton", { name: "Interpretación de pruebas", exact: true })
    .fill("1");
  await page.getByRole("button", { name: "Calcular propuesta" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu propuesta de práctica" }),
  ).toBeVisible();
  await expect(page.getByText(/1 casos · \d+ preguntas/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar y comenzar" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
});

test("entrada diagnóstica conserva intención y preferencias elegidas", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Explorar mi ruta", exact: true })
    .click();
  await expect(page).toHaveURL(/intent=diagnostic/);
  await page
    .getByLabel("Mundo clínico", { exact: true })
    .selectOption({ label: "Medicina interna" });
  await page
    .getByRole("checkbox", { name: "Endocrinología", exact: true })
    .check();
  await page
    .getByLabel("Objetivo de entrenamiento")
    .fill("Identificar mis brechas");
  await page.getByLabel("Nombre", { exact: true }).fill("Diagnóstico inicial");
  await page
    .getByLabel("Universidad", { exact: true })
    .fill("Universidad de prueba");
  await page.getByLabel("Carrera", { exact: true }).fill("Medicina");
  await page
    .getByLabel("Correo electrónico")
    .fill(`diagnostic-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/diagnostico$/);
  await expect(
    page.getByRole("checkbox", { name: "Endocrinología", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Usar estas preferencias" }).click();
  await page.getByRole("button", { name: "Calcular propuesta" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu propuesta de diagnóstico" }),
  ).toBeVisible();
  await expect(page.getByText(/10 preguntas objetivo/)).toBeVisible();
  await page.screenshot({
    path: "test-results/diagnostic-proposal.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirmar y comenzar" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole("radio")).toHaveCount(4);
});
