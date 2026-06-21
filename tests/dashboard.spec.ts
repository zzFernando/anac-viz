import { test, expect } from "@playwright/test";

test.describe("Dashboard carrega", () => {
  test("pagina abre sem crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/");
    await page.waitForTimeout(5000);
    const fatal = errors.filter(e => !e.includes("Warning"));
    expect(fatal).toHaveLength(0);
  });

  test("SVGs renderizam", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
    const count = await page.locator("svg").count();
    expect(count).toBeGreaterThan(3);
  });
});

test.describe("Toggles ADS", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
  });

  for (const label of ["Barras", "Lollipop", "Dot", "Waffle", "Radial", "Heatmap", "Pictograma"]) {
    test("ADS: " + label, async ({ page }) => {
      const btns = page.getByRole("button", { name: label });
      if (await btns.count() > 0) {
        await btns.last().click();
        await page.waitForTimeout(800);
        await expect(page.locator("#chart-ads")).toBeVisible();
        const box = await page.locator("#chart-ads").boundingBox();
        expect(box?.height ?? 0).toBeGreaterThan(10);
      }
    });
  }
});

test.describe("Toggles ATA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
  });

  for (const label of ["Barras", "Lollipop", "Pareto", "Waffle"]) {
    test("ATA: " + label, async ({ page }) => {
      const btns = page.getByRole("button", { name: label });
      if (await btns.count() > 0) {
        await btns.first().click();
        await page.waitForTimeout(800);
        await expect(page.locator("#chart-ata")).toBeVisible();
      }
    });
  }
});

test.describe("Toggles Fase do Voo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
  });

  for (const label of ["Barras", "Radial", "Waffle"]) {
    test("Fase: " + label, async ({ page }) => {
      const btns = page.getByRole("button", { name: label });
      if (await btns.count() > 0) {
        await btns.last().click();
        await page.waitForTimeout(800);
        await expect(page.locator("#chart-ocorr-fase")).toBeVisible();
      }
    });
  }
});

test.describe("Toggles Top Rotas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(5000);
  });

  for (const label of ["Barras", "Donut", "Treemap"]) {
    test("Rotas: " + label, async ({ page }) => {
      const btns = page.getByRole("button", { name: label });
      if (await btns.count() > 0) {
        await btns.first().click();
        await page.waitForTimeout(800);
        expect(await page.locator("svg").count()).toBeGreaterThan(0);
      }
    });
  }
});
