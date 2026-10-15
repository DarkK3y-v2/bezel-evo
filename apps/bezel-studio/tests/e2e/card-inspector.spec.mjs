// The card's inspector (artboards CardFaces, CardMotion, CardTriggers):
// face thumbnails, the base, "Move", the rotation stepper and quick
// durations, effect cards, the rule sentences, their order and the common
// return. Every edit is one Undo step.
import { test, expect, watchErrors, expectAccessible, clickAddWidget as add, openInspectorTab as tab, setPanelWidths } from './helpers.mjs';

/** A card with two faces: a text in the base, a ring in face 1, a bar and a graph in face 2 (in view). */
async function twoFaceCard(page, t) {
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const inspector = page.locator('#inspector');
  await add(page, t, 'card');
  const cardName = await inspector.getByLabel(t('inspector.name'), { exact: true }).inputValue();
  const selectCard = async () => {
    await page.locator('#tab-layers').click();
    await page.locator('.layer-name').filter({ hasText: cardName }).first().click();
    await page.locator('#tab-widgets').click();
  };
  await add(page, t, 'ring');
  await selectCard();
  await inspector.getByRole('button', { name: t('card.addFace'), exact: true }).click();
  await add(page, t, 'bar');
  await add(page, t, 'graph');
  await selectCard();
  return { inspector, selectCard };
}

test('faces are screen thumbnails; the base lists its objects; Move sends an object to another face', async ({ page, t }) => {
  const errors = watchErrors(page);
  const { inspector, selectCard } = await twoFaceCard(page, t);
  const faces = inspector.getByRole('group', { name: t('card.activeFace'), exact: true });
  await expect(faces.locator('[data-face]')).toHaveCount(2);
  await expect(faces.locator('[aria-pressed="true"]')).toHaveAttribute('data-face', '1');
  // In the screen's proportions (480 × 1920), each face drawing its objects.
  const ratio = await faces.locator('[data-face="1"] .screen-thumb').evaluate(n => n.clientWidth / n.clientHeight);
  expect(ratio).toBeCloseTo(480 / 1920, 1);
  await expect(faces.locator('[data-face="1"] .face-mark')).toHaveCount(2);
  await expect(faces.locator('[data-face="0"] .face-mark')).toHaveCount(1);
  const objects = inspector.locator('[data-section="objects"]');
  await expect(objects.getByRole('heading')).toHaveText(t('cardInsp.objectsIn', { face: t('card.faceName', { number: 2 }) }));
  await expect(objects.locator('.count')).toHaveText('2');
  await expect(objects.locator('.face-object')).toHaveCount(2);
  // Move the bar to face 1: it leaves this list and lands there; Undo brings it back.
  await objects.getByRole('combobox', { name: t('cardInsp.moveObject', { name: t('widget.bar') }) }).selectOption('0');
  await expect(objects.locator('.face-object')).toHaveCount(1);
  await expect(faces.locator('[data-face="0"] .face-mark')).toHaveCount(2);
  await page.locator('#undo').click();
  await expect(objects.locator('.face-object')).toHaveCount(2);
  // To the base, then the base's list shows it (and the face editor steps aside).
  await objects.getByRole('combobox', { name: t('cardInsp.moveObject', { name: t('widget.bar') }) }).selectOption('base');
  const base = inspector.getByRole('button', { name: t('cardInsp.base'), exact: true });
  await base.click();
  await expect(base).toHaveAttribute('aria-pressed', 'true');
  await expect(objects.getByRole('heading')).toHaveText(t('cardInsp.objectsIn', { face: t('cardInsp.base') }));
  await expect(objects.locator('.face-object')).toHaveCount(1);
  await expect(inspector.getByLabel(t('card.faceTitle'), { exact: true })).toHaveCount(0);
  await faces.locator('[data-face="1"]').click();
  await expect(base).toHaveAttribute('aria-pressed', 'false');
  await expect(inspector.getByLabel(t('card.faceTitle'), { exact: true })).toBeVisible();
  // A list card selects its object.
  await objects.getByRole('button', { name: t('cardInsp.selectObject', { name: t('widget.graph') }), exact: true }).click();
  await expect(inspector.getByRole('tab', { name: t('card.tab.faces'), exact: true })).toHaveCount(0);
  await selectCard();
  await expect(inspector.getByText(t('cardInsp.dropHint'), { exact: true })).toBeVisible();
  await inspector.getByRole('tabpanel', { name: t('card.tab.faces'), exact: true }).screenshot({ path: test.info().outputPath('faces-content.png') });
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('rotation has a stepper and quick durations; effects are picture cards; one Undo step each', async ({ page, t }) => {
  const errors = watchErrors(page);
  const { inspector } = await twoFaceCard(page, t);
  await tab(page, t, 'card.tab.motion');
  await inspector.getByRole('switch', { name: t('card.autoRotate'), exact: true }).check();
  const seconds = inspector.getByRole('spinbutton', { name: t('card.rotationSeconds'), exact: true });
  await expect(seconds).toHaveValue('10');
  await inspector.getByRole('button', { name: t('cardInsp.increase'), exact: true }).click();
  await expect(seconds).toHaveValue('11');
  await inspector.getByRole('button', { name: t('cardInsp.decrease'), exact: true }).click();
  await inspector.getByRole('button', { name: t('cardInsp.decrease'), exact: true }).click();
  await expect(seconds).toHaveValue('9');
  const quick = inspector.getByRole('group', { name: t('cardInsp.quickDurations'), exact: true });
  await quick.getByRole('button', { name: t('unit.minutes', { value: 1 }), exact: true }).click();
  await expect(seconds).toHaveValue('60');
  await expect(quick.getByRole('button', { name: t('unit.minutes', { value: 1 }), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#undo').click();
  await expect(seconds).toHaveValue('9');
  await seconds.fill('2');
  await seconds.press('Tab');
  await expect(seconds).toHaveValue('5');
  await expect(inspector.getByRole('button', { name: t('cardInsp.decrease'), exact: true })).toBeDisabled();
  await expect(inspector).toContainText(t('cardInsp.paused'));
  await inspector.locator('.card-rotation-help summary').click();
  await expect(inspector.getByText(t('card.rotationHelp'), { exact: true })).toBeVisible();
  await inspector.locator('.card-rotation-help summary').click();
  // Effects: four radio cards, each with its picture.
  const effects = inspector.getByRole('radiogroup', { name: t('card.effect'), exact: true });
  await expect(effects.getByRole('radio')).toHaveCount(4);
  await expect(effects.locator('svg.effect-art')).toHaveCount(4);
  await expect(effects.getByRole('radio', { name: t('card.effect.none'), exact: true })).toBeChecked();
  await expect(inspector.getByRole('slider', { name: new RegExp(t('card.duration')) })).toHaveCount(0);
  await effects.getByRole('radio', { name: t('card.effect.slide'), exact: true }).check();
  await expect(inspector.getByRole('slider', { name: new RegExp(t('card.duration')) })).toHaveValue('650');
  await expect(inspector.locator('.card-scale')).toContainText(t('cardInsp.fast'));
  const up = inspector.getByRole('group', { name: t('card.direction'), exact: true }).getByRole('button', { name: t('card.direction.up'), exact: true });
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#undo').click();
  await expect(inspector.getByRole('group', { name: t('card.direction'), exact: true }).getByRole('button', { name: t('card.direction.left'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.getByRole('button', { name: t('card.animateNext'), exact: true })).toBeEnabled();
  await inspector.getByRole('tabpanel', { name: t('card.tab.motion'), exact: true }).screenshot({ path: test.info().outputPath('motion-content.png') });
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('triggers read as sentences with tokens, reorder by keyboard, and share one return', async ({ page, t }) => {
  const errors = watchErrors(page);
  const { inspector } = await twoFaceCard(page, t);
  await tab(page, t, 'card.tab.triggers');
  await expect(inspector).toContainText(t('cardInsp.triggersIntro'));
  const returnTo = inspector.getByRole('combobox', { name: t('trigger.returnFace'), exact: true });
  await expect(returnTo).toBeDisabled();
  const addRule = inspector.getByRole('button', { name: t('trigger.add'), exact: true });
  await addRule.click();
  await addRule.click();
  const rules = inspector.locator('.trigger-rule');
  await expect(rules).toHaveCount(2);
  const first = inspector.getByRole('group', { name: t('trigger.rule', { value: 1 }), exact: true });
  // Music in any app: the sentence says "in" before the app, empty = any app.
  await expect(first.locator('.rule-word')).toHaveText([t('cardInsp.when'), t('cardInsp.in'), t('cardInsp.show')]);
  await expect(first.getByRole('combobox', { name: t('trigger.app') })).toHaveAttribute('placeholder', t('cardInsp.anyApp'));
  await first.getByRole('combobox', { name: t('trigger.condition'), exact: true }).selectOption('foreground');
  await expect(first.locator('.rule-word')).toHaveText([t('cardInsp.when'), t('cardInsp.show')]);
  const app = first.getByRole('combobox', { name: t('trigger.app') });
  await expect(app).not.toHaveValue('');
  await app.fill('obs64');
  await app.press('Tab');
  await expect(app).toHaveValue('obs64');
  const priority = first.getByRole('spinbutton', { name: t('trigger.priority'), exact: true });
  await priority.fill('80');
  await priority.press('Tab');
  await first.getByRole('combobox', { name: t('trigger.face'), exact: true }).selectOption('0');
  // Rule 1 goes down with the keyboard: the second card now holds it; Undo puts it back.
  await first.getByRole('button', { name: t('cardInsp.reorder', { value: 1 }), exact: true }).press('ArrowDown');
  const second = inspector.getByRole('group', { name: t('trigger.rule', { value: 2 }), exact: true });
  await expect(second.getByRole('combobox', { name: t('trigger.app') })).toHaveValue('obs64');
  await expect(second.getByRole('spinbutton', { name: t('trigger.priority'), exact: true })).toHaveValue('80');
  await expect(inspector.getByRole('button', { name: t('cardInsp.reorder', { value: 2 }), exact: true })).toBeFocused();
  await page.locator('#undo').click();
  await expect(first.getByRole('combobox', { name: t('trigger.app') })).toHaveValue('obs64');
  // Dragging the handle below rule 2 moves it there too, one Undo step.
  const handle = first.getByRole('button', { name: t('cardInsp.reorder', { value: 1 }), exact: true });
  const from = await handle.boundingBox(), target = await second.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, target.y + target.height - 4, { steps: 8 });
  await page.mouse.up();
  await expect(second.getByRole('combobox', { name: t('trigger.app') })).toHaveValue('obs64');
  await page.locator('#undo').click();
  await expect(first.getByRole('combobox', { name: t('trigger.app') })).toHaveValue('obs64');
  // One return for every rule.
  await expect(returnTo).toBeEnabled();
  await expect(returnTo).toHaveValue('previous');
  await returnTo.selectOption('0');
  await expect(returnTo).toHaveValue('0');
  await page.locator('#undo').click();
  await expect(returnTo).toHaveValue('previous');
  await expect(inspector).toContainText(t('cardInsp.priorityHint'));
  await inspector.getByRole('tabpanel', { name: t('card.tab.triggers'), exact: true }).screenshot({ path: test.info().outputPath('triggers-content.png') });
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('triggers stay off with one face, and a rule removed leaves the return disabled again', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page, t, 'card');
  const inspector = page.locator('#inspector');
  await tab(page, t, 'card.tab.triggers');
  await expect(inspector.getByRole('button', { name: t('trigger.add'), exact: true })).toBeDisabled();
  await expect(inspector).toContainText(t('cardInsp.needsFaces'));
  await tab(page, t, 'card.tab.faces');
  await inspector.getByRole('button', { name: t('card.addFace'), exact: true }).click();
  await tab(page, t, 'card.tab.triggers');
  await inspector.getByRole('button', { name: t('trigger.add'), exact: true }).click();
  await inspector.getByRole('button', { name: t('trigger.remove'), exact: true }).click();
  await expect(inspector.locator('.trigger-rule')).toHaveCount(0);
  await expect(inspector.getByRole('combobox', { name: t('trigger.returnFace'), exact: true })).toBeDisabled();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test.describe('Italian mockup comparison', () => {
  test.use({ locale: 'it-IT' });
  test('populated Card panels match the standalone board width', async ({ page, t }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 1440 });
    await page.goto('/index.html?demo=turing88');
    await setPanelWidths(page, { inspector: 360 });
    const { inspector } = await twoFaceCard(page, t);
    expect(await inspector.evaluate(node => node.getBoundingClientRect().width)).toBe(360);
    await inspector.getByRole('tabpanel', { name: t('card.tab.faces'), exact: true }).screenshot({ path: test.info().outputPath('CardFaces-it.png') });
    await tab(page, t, 'card.tab.motion');
    await inspector.getByRole('switch', { name: t('card.autoRotate'), exact: true }).check();
    await inspector.getByRole('radio', { name: t('card.effect.slide'), exact: true }).check();
    await inspector.getByRole('tabpanel', { name: t('card.tab.motion'), exact: true }).screenshot({ path: test.info().outputPath('CardMotion-it.png') });
    await tab(page, t, 'card.tab.triggers');
    await inspector.getByRole('button', { name: t('trigger.add'), exact: true }).click();
    await inspector.getByRole('button', { name: t('trigger.add'), exact: true }).click();
    await inspector.getByRole('tabpanel', { name: t('card.tab.triggers'), exact: true }).screenshot({ path: test.info().outputPath('CardTriggers-it.png') });
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });
});

test('the shared context renders real face pixels and supplies live trigger app choices', async ({ page, t, lang }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  // Exercise the pending host wiring without editing the frozen inspector.
  await page.evaluate(async locale => {
    const [{ renderCardPanel }, { createStore }, { createDemoBackend }, { translator }, { el }, { propertySection }] = await Promise.all([
      import('/ui/inspector-card.js'), import('/editor/store.js'), import('/demo-backend.js'), import('/i18n/index.js'), import('/ui/dom.js'), import('/ui/fields.js'),
    ]);
    const bridge = createDemoBackend('turing88');
    const store = createStore((await bridge.session()).theme);
    const translate = translator(locale);
    store.dispatch('add', { widget: 'card', x: 240, y: 960 });
    const id = store.getState().selection[0];
    store.dispatch('add', { widget: 'ring', x: 240, y: 960 });
    store.dispatch('addCardFace', { id, name: translate('card.faceName', { number: 2 }) });
    store.dispatch('add', { widget: 'bar', x: 240, y: 960 });
    store.select([id]);
    let sample = await bridge.sample();
    let selectedTab = 'faces';
    const root = el('aside', { id: 'card-probe', class: 'inspector', style: { position: 'fixed', inset: '52px 0 30px auto', width: '360px', zIndex: '100' } });
    document.body.append(root);
    const render = () => root.replaceChildren(...renderCardPanel(selectedTab, {
      element: store.getState().theme.elements.find(e => e.id === id), store, t: translate, bridge,
      host: { lastSample: () => sample }, update: (elementId, patch) => store.dispatch('update', { id: elementId, patch }),
      section: propertySection,
    }).filter(Boolean));
    store.subscribe(render);
    render();
    globalThis.cardProbe = { triggers: () => { selectedTab = 'triggers'; render(); }, stopActivity: () => { sample = { ...sample, activity: null }; } };
  }, lang);
  const probe = page.locator('#card-probe');
  await expect(probe.locator('.face-render')).toHaveCount(3);
  const pixels = await probe.locator('.face-render').evaluateAll(nodes => nodes.map(canvas => Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data)));
  expect(pixels[0].some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
  expect(pixels[1]).not.toEqual(pixels[0]);
  await page.evaluate(() => cardProbe.triggers());
  await probe.getByRole('button', { name: t('trigger.add'), exact: true }).click();
  await probe.getByRole('combobox', { name: t('trigger.condition'), exact: true }).selectOption('foreground');
  await expect(probe.getByRole('combobox', { name: t('trigger.app'), exact: true })).toHaveValue('chrome');
  await expect(probe.locator('datalist option[value="chrome"]')).toHaveCount(1);
  await expect(probe.locator('datalist option[value="explorer"]')).toHaveCount(1);
  await page.evaluate(() => cardProbe.stopActivity());
  await expect(probe.locator('datalist option[value="explorer"]')).toHaveCount(0);
  await expect(probe.getByRole('combobox', { name: t('trigger.app'), exact: true })).toHaveValue('chrome');
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
