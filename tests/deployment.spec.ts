import { test, expect } from "@playwright/test";

test("recuperación deshabilitada en despliegue público", async ({ page }) => {
  test.skip(
    process.env.VITE_PASSWORD_RECOVERY_ENABLED === "true",
    "Local mail regression suite enables recovery explicitly",
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unauthorized", message: "Inicia sesión" },
      }),
    }),
  );
  await page.goto("/ingresar");
  await expect(
    page.getByRole("link", { name: "Olvidé mi contraseña" }),
  ).toHaveCount(0);
  for (const path of ["/recuperar", "/restablecer#token=test"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Recuperación no disponible" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Enviar enlace|Guardar contraseña/ }),
    ).toHaveCount(0);
  }
});
