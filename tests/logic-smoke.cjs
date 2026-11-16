const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
let source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
source = source.replace(/\$\('saveRewardBtn'\)\.addEventListener\('click',\(\)=>\{\}\);[\s\S]*?boot\(\);\s*$/, '// boot suppressed in smoke test\n');
const local = {};
const context = {
  console, Date, Math, JSON, Number, String, Array, Object, Set, Map, Promise,
  Uint8Array, Blob, URL, Intl, RegExp, Error, parseInt, parseFloat,
  localStorage: {
    getItem: key => local[key] || null,
    setItem: (key, value) => { local[key] = value; },
    removeItem: key => { delete local[key]; }
  },
  window: {}, navigator: { onLine: true },
  setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams,
  document: { getElementById: () => null }, performance: { now: () => 0 }
};
vm.createContext(context);
vm.runInContext(source, context, { timeout: 10000 });
const template = JSON.parse(fs.readFileSync(path.join(root, 'data', 'balance_templates.json'), 'utf8'));
vm.runInContext('templateOriginal=normalizeTemplate(' + JSON.stringify(template) + '); state=newState(templateOriginal);', context);
context.assert = assert;

const result = vm.runInContext(`(function () {
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.theories.length, 4);
  let taskCount = 0, noIcon = 0;
  state.theories.forEach(t => t.sections.forEach(s => {
    taskCount += countNodes(s.tasks);
    const visit = list => list.forEach(n => { if (!n.icon) noIcon++; visit(n.children || []); });
    visit(s.tasks);
  }));
  assert.equal(taskCount, 278);
  assert.equal(noIcon, 0);
  const iconCount = Object.keys(ICON_PATHS).length;
  assert.equal(iconCount, 48);
  assert.equal(ICON_LIBRARY.length, 48);
  assert(ICON_LIBRARY.every(item => !!ICON_PATHS[item[0]]));
  assert(iconSvg('book-open').includes('<svg'));

  const old = JSON.parse(JSON.stringify(state));
  old.schemaVersion = 1; delete old.dailyPlans; delete old.inbox; delete old.postponements; delete old.settings.modules;
  const migrated = migrateState(old);
  assert.equal(migrated.schemaVersion, 2);
  assert(Array.isArray(migrated.inbox));
  assert.equal(migrated.settings.modules.analytics, true);

  const badNode = normalizeNode({ id: 'bad\" onmouseover=alert(1)', name: 'قراءة', children: [] });
  assert(/^[A-Za-z0-9_-]{1,80}$/.test(badNode.id));
  assert.equal(badNode.icon, 'book-open');

  const taskId = 'smoke_due_task';
  const section = state.theories[0].sections[0];
  section.tasks.push({ id: taskId, name: 'مهمة بتاريخ استحقاق', enabled: true, priority: 2, dueDate: dateKey(), children: [] });
  let found = findTask(taskId);
  assert(found && taskOccursToday(found.node));
  state.logs.push({ id: 'smoke_log', type: 'task', taskId, date: dateKey() });
  found.node.completed = true;
  assert(taskOccursToday(found.node));
  assert(!taskOccursToday(found.node, addDays(dateKey(), 1)));

  const habit = normalizeNode({
    id: 'smoke_habit', name: 'قراءة يومية', enabled: true, priority: 2, spacedReview: true,
    schedule: { enabled: true, repeat: 'daily', minutes: 15, days: ['sun','mon','tue','wed','thu','fri','sat'] }, children: []
  });
  assert(taskOccursToday(habit));
  assert(habit.effort.minimum && habit.schedule.minimum);
  section.tasks.push(habit);
  save = () => { mutationVersion++; };
  renderAll = () => {};
  renderReviewQueue = () => {};
  toast = () => {};
  toastUndo = () => {};
  setTaskTier('smoke_habit', 'minimum');
  assert.equal(getLog('smoke_habit').tier, 'minimum');
  const firstReview = state.reviewQueue.find(x => x.status === 'pending');
  assert(firstReview);
  assert.equal(firstReview.dueDate, addDays(dateKey(), 1));
  completeSpacedReview(firstReview.id);
  const secondReview = state.reviewQueue.filter(x => x.status === 'pending')[0];
  assert(secondReview);
  assert.equal(secondReview.dueDate, addDays(dateKey(), 3));

  let icsFilename = '';
  downloadBlob = (blob, filename) => { icsFilename = filename; };
  exportICS();
  assert(icsFilename.endsWith('.ics'));

  return {
    theories: state.theories.length,
    sections: state.theories.reduce((n, t) => n + t.sections.length, 0),
    tasks: taskCount,
    icons: iconCount,
    migratedSchema: migrated.schemaVersion,
    flexibleHabitTier: getLog('smoke_habit').tier,
    spacedReviewItems: state.reviewQueue.length,
    calendarExport: icsFilename
  };
})()`, context);

console.log(JSON.stringify({ passed: true, ...result }, null, 2));
