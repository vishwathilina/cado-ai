#!/usr/bin/env node
/* Record silent 1080p reference clips for the Devpost edit.
 *
 * One-time dependency (not saved to package.json):
 *   npm install --no-save --package-lock=false playwright
 *
 * Run while frontend and backend are available:
 *   node scripts/record-devpost-demo.mjs
 */

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.DEMO_BASE_URL || "http://localhost:3000";
const email = process.env.DEMO_EMAIL || "demo@cado.study";
const password = process.env.DEMO_PASSWORD || "CadoDemo2026!";
const outputDir = resolve(process.cwd(), "../demo-video-clips");
const sourcePdf = resolve(process.cwd(), "public/cado-demo-notes.pdf");
const executablePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--hide-scrollbars", "--font-render-hinting=none"],
});

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function saveVideo(context, page, name) {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(resolve(outputDir, `${name}.webm`));
}

async function newRecordedContext(storageState) {
  return browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } },
    colorScheme: "dark",
  });
}

// Opening: landing and sign-in transition.
{
  const context = await newRecordedContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await wait(1600);
  await page.mouse.wheel(0, 520);
  await wait(1800);
  await page.goto("/login");
  await wait(1500);
  await saveVideo(context, page, "01-opening-login");
}

// Build an authenticated storage state once, then reuse it in every clip.
const authContext = await browser.newContext({ baseURL });
const authPage = await authContext.newPage();
await authPage.goto("/login");
await authPage.getByLabel("Email").fill(email);
await authPage.getByLabel("Password").fill(password);
await authPage.getByRole("button", { name: /sign in/i }).click();
await authPage.waitForURL("**/dashboard");
await authPage.waitForLoadState("networkidle");
const dashboard = await authPage.evaluate(async () => {
  const response = await fetch("/api/backend/dashboard");
  if (!response.ok) throw new Error(`Dashboard request failed: ${response.status}`);
  return response.json();
});
const setId = dashboard.recent_sets[0].id;
const storageState = await authContext.storageState();
await authContext.close();

// Upload configuration. Generation is intentionally not submitted in the
// reference take; splice in a separately captured progress segment if wanted.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto("/upload");
  await page.waitForLoadState("networkidle");
  await wait(1000);
  await page.locator('input[type="file"]').setInputFiles(sourcePdf);
  await wait(1600);
  await page.mouse.wheel(0, 620);
  await wait(2200);
  await saveVideo(context, page, "02-upload-options");
}

// Learn: explanations, vocabulary, flashcard flip and confidence.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto(`/learn/${setId}`);
  await page.waitForLoadState("networkidle");
  await wait(1200);
  await page.getByRole("button", { name: /vocabulary/i }).click();
  await wait(1200);
  await page.getByRole("tab", { name: /flashcards/i }).click();
  await wait(1100);
  await page.getByRole("button", { name: /front/i }).click();
  await wait(1300);
  await page.getByRole("button", { name: /got it/i }).click();
  await wait(1000);
  await saveVideo(context, page, "03-learn-flashcards");
}

// Tutor: pre-tested notes-grounded question and citations.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto(`/learn/${setId}?ask=1`);
  await page.waitForLoadState("networkidle");
  await wait(1200);
  const composer = page.getByPlaceholder(/ask about/i);
  await composer.fill("Why do plants need both photosynthesis and cellular respiration?");
  await page.getByRole("button", { name: /ask cado/i }).click();
  await page.getByText("From your notes").last().waitFor({ timeout: 60000 });
  await wait(1800);
  await saveVideo(context, page, "04-tutor-citations");
}

// Quiz shell and question navigation.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto(`/quiz/${setId}`);
  await page.waitForLoadState("networkidle");
  await wait(1300);
  const optionButtons = page.locator("main button").filter({ hasText: /thylakoid membrane/i });
  if (await optionButtons.count()) {
    await optionButtons.first().click();
    await wait(1600);
  }
  await saveVideo(context, page, "05-quiz");
}

// Populated Today dashboard and plan section.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await wait(1400);
  await page.mouse.wheel(0, 760);
  await wait(1800);
  await page.getByText("Biology Exam Sprint", { exact: true }).first().scrollIntoViewIfNeeded();
  await wait(1700);
  await saveVideo(context, page, "06-dashboard-plan");
}

// History and theme personalization.
{
  const context = await newRecordedContext(storageState);
  const page = await context.newPage();
  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  await wait(1700);
  const themeButton = page.getByRole("button", { name: /theme|light|dark/i }).last();
  if (await themeButton.count()) {
    await themeButton.click();
    await wait(1500);
  }
  await saveVideo(context, page, "07-history-theme");
}

await browser.close();
console.log(`Recorded 7 reference clips in ${outputDir}`);
