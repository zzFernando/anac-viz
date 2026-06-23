import { test, expect } from "@playwright/test";

async function carregarDashboard(page: import("@playwright/test").Page, theme?: "light" | "dark") {
  await page.goto("/");
  if (theme) {
    await page.evaluate((value) => {
      window.localStorage.setItem("theme", value);
    }, theme);
    await page.reload();
  }
  await page.waitForTimeout(5000);
}

test.describe("Dashboard carrega", () => {
  test("pagina abre sem crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await carregarDashboard(page);
    const fatal = errors.filter(e => !e.includes("Warning"));
    expect(fatal).toHaveLength(0);
  });

  test("SVGs renderizam", async ({ page }) => {
    await carregarDashboard(page);
    const count = await page.locator("svg").count();
    expect(count).toBeGreaterThan(3);
  });
});

test.describe("Dark mode", () => {
  test("aplica tema escuro, alterna e persiste a preferencia", async ({ page }) => {
    await carregarDashboard(page, "dark");

    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(true);
    await expect(page.getByRole("button", { name: "Mudar para modo claro" })).toBeVisible();

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe("rgb(15, 23, 42)");

    const cardBg = await page.locator(".section-title").first().evaluate((el) => {
      const card = el.closest(".bg-white");
      return card ? getComputedStyle(card).backgroundColor : "";
    });
    expect(cardBg).toBe("rgb(30, 41, 59)");

    await page.getByRole("button", { name: "Mudar para modo claro" }).click();

    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(false);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("theme"))).toBe("light");

    await page.reload();
    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(false);
    await expect(page.getByRole("button", { name: "Mudar para modo escuro" })).toBeVisible();
  });

  test("mantem controles e graficos legiveis no tema escuro", async ({ page }) => {
    await carregarDashboard(page, "dark");
    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(true);

    await page.locator("button[title='Barras']").first().click();
    await page.waitForTimeout(800);
    await expect(page.locator("#chart-bar")).toBeVisible();

    const gridStroke = await page.locator("#chart-bar .grid line").first().evaluate((el) => {
      return getComputedStyle(el).stroke;
    });
    expect(gridStroke).toBe("rgb(30, 41, 59)");

    const axisTextFill = await page.locator("#chart-bar text").last().evaluate((el) => {
      return getComputedStyle(el).fill;
    });
    expect(axisTextFill).not.toBe("rgb(15, 23, 42)");

    await page.getByText("Metodologia e notas").click();
    const noteBg = await page.locator("details.group").evaluate(el => getComputedStyle(el).backgroundColor);
    expect(noteBg).toBe("rgb(30, 41, 59)");

    await page.locator("#chart-frota-empresas").scrollIntoViewIfNeeded();
    const parallelPlotBg = await page.locator("#chart-frota-empresas rect.plot-bg").evaluate((el) => {
      return getComputedStyle(el).fill;
    });
    expect(parallelPlotBg).toBe("rgb(15, 23, 42)");

    const parallelValueBg = await page.locator("#chart-frota-empresas rect.value-bg").first().evaluate((el) => {
      return getComputedStyle(el).fill;
    });
    expect(parallelValueBg).toBe("rgb(30, 41, 59)");

    await page.locator("#chart-frota-modelos").scrollIntoViewIfNeeded();
    const lollipopStem = page.locator("#chart-frota-modelos line.stem").first();
    await expect(lollipopStem).toBeVisible();
    const lollipopStroke = await lollipopStem.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { color: styles.stroke, width: Number.parseFloat(styles.strokeWidth) };
    });
    expect(lollipopStroke.color).not.toBe("rgb(15, 23, 42)");
    expect(lollipopStroke.width).toBeGreaterThan(2.5);
  });
});

test.describe("Toggles ADS", () => {
  test.beforeEach(async ({ page }) => {
    await carregarDashboard(page);
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
    await carregarDashboard(page);
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
    await carregarDashboard(page);
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
    await carregarDashboard(page);
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
