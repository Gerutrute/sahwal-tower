const REQUIRED_TOP_LEVEL_FIELDS = [
  'seed',
  'komiBySize',
  'economy',
  'mapWeights',
  'effectLimits',
  'generalCaptureMoneyCap',
  'enemyDeck',
  'bossByAct',
  'rewards',
  'shop',
  'eventCurrencyReward',
  'aiCaptureWeight',
  'aiEffectWeights',
  'aiPassScoreThreshold',
  'analysisCaptureWeight',
  'analysisEffectWeight',
  'audioTuning',
];

const STONE_KINDS = [
  'STONE-001',
  'STONE-002',
  'STONE-003',
  'STONE-004',
  'STONE-005',
  'STONE-006',
];

export const RUNTIME_CONFIG_SCRIPT_TAG = '<script src="./runtime-config.js"></script>';

function schemaFailure(fields) {
  return { ok: false, code: 'RUNTIME_CONFIG_SCHEMA_INVALID', fields: [...new Set(fields)] };
}

export function validateGameConfigText(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, code: 'RUNTIME_CONFIG_MISSING' };
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return { ok: false, code: 'RUNTIME_CONFIG_INVALID_JSON' };
  }

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return schemaFailure(['$']);
  }

  const fields = REQUIRED_TOP_LEVEL_FIELDS.filter((field) => !Object.hasOwn(config, field));
  const komiBySize = config.komiBySize;
  if (komiBySize === null || typeof komiBySize !== 'object' || Array.isArray(komiBySize)) {
    fields.push('komiBySize');
  } else {
    if (!Number.isFinite(komiBySize[7])) fields.push('komiBySize.7');
    if (!Number.isFinite(komiBySize[9])) fields.push('komiBySize.9');
  }

  const aiEffectWeights = config.aiEffectWeights;
  if (aiEffectWeights === null || typeof aiEffectWeights !== 'object' || Array.isArray(aiEffectWeights)) {
    fields.push('aiEffectWeights');
  } else {
    const actualKinds = Object.keys(aiEffectWeights).sort();
    if (actualKinds.length !== STONE_KINDS.length
      || actualKinds.some((kind, index) => kind !== STONE_KINDS[index])) {
      fields.push('aiEffectWeights');
    }
  }

  if (!Array.isArray(config.enemyDeck) || config.enemyDeck.length === 0) {
    fields.push('enemyDeck');
  }

  return fields.length > 0 ? schemaFailure(fields) : { ok: true, config };
}

export function renderRuntimeConfigJs(config, target) {
  const deployTarget = target === 'production' ? 'production' : 'preview';
  const deployMeta = { target: deployTarget, playtest: deployTarget !== 'production' };
  return [
    `window.__ROGOLIKE_DEPLOY_META__ = Object.freeze(${JSON.stringify(deployMeta)});`,
    `window.__ROGOLIKE_GAME_CONFIG__ = ${JSON.stringify(config)};`,
    '',
  ].join('\n');
}

export function injectRuntimeConfigScript(html) {
  if (html.includes(RUNTIME_CONFIG_SCRIPT_TAG)) {
    throw new Error('RUNTIME_CONFIG_SCRIPT_ALREADY_INJECTED');
  }
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) {
    throw new Error('RUNTIME_CONFIG_HEAD_MISSING');
  }
  const headStart = html.indexOf('<head');
  const headOpenEnd = headStart === -1 ? -1 : html.indexOf('>', headStart);
  if (headOpenEnd === -1 || headOpenEnd > headEnd) {
    throw new Error('RUNTIME_CONFIG_HEAD_MISSING');
  }

  const moduleScripts = [];
  const headContent = html.slice(headOpenEnd + 1, headEnd).replace(
    /\s*<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi,
    (script) => {
      moduleScripts.push(script.trim());
      return '';
    },
  );
  const beforeHeadContent = html.slice(0, headOpenEnd + 1);
  const afterHead = html.slice(headEnd + '</head>'.length);
  const injectedHead = `${beforeHeadContent}${headContent}${RUNTIME_CONFIG_SCRIPT_TAG}</head>`;
  if (moduleScripts.length === 0) return `${injectedHead}${afterHead}`;

  const bodyOpen = afterHead.match(/<body\b[^>]*>/i);
  if (bodyOpen === null || bodyOpen.index === undefined) {
    return `${injectedHead}\n${moduleScripts.join('\n')}${afterHead}`;
  }
  const bodyOpenEnd = bodyOpen.index + bodyOpen[0].length;
  return `${injectedHead}${afterHead.slice(0, bodyOpenEnd)}\n${moduleScripts.join('\n')}${afterHead.slice(bodyOpenEnd)}`;
}
