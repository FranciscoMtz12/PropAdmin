import { Page } from "@playwright/test";

export const BASE = "https://prop-admin-teal.vercel.app";

export const USERS = {
  superadmin:     { email: "fco.mtz.c@hotmail.com",        password: "Pruebas1" },
  administracion: { email: "administracion@fra-mar.mx",     password: "Administracion01" },
  compras:        { email: "compras@fra-mar.mx",            password: "Compras01" },
  mantenimiento:  { email: "mantenimiento@fra-mar.mx",      password: "Mantenimiento01" },
  campo:          { email: "campo@fra-mar.mx",              password: "Equipocampo01" },
} as const;

export async function login(page: Page, role: keyof typeof USERS) {
  const { email, password } = USERS[role];
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait until navigated away from /login (each role redirects to its own route)
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 20000 });
}

export async function logout(page: Page) {
  // Try sidebar logout button or navigate to login
  const logoutBtn = page.locator('button:has-text("Cerrar sesión"), button:has-text("Salir"), [aria-label="logout"]').first();
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click();
  } else {
    await page.goto("/login");
  }
}
