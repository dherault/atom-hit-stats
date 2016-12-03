'use babel';

/* global atom, document */
import fs from 'fs';
import path from 'path';
import { CompositeDisposable } from 'atom'; // eslint-disable-line

function isDifferentDay(previousDate, nextDate) {
  const a = new Date(previousDate);
  const b = new Date(nextDate);

  return (
    a.getDate() !== b.getDate() ||
    a.getMonth() !== b.getMonth() ||
    a.getFullYear() !== b.getFullYear()
  );
}

export default {

  keyCountStatsView: null,
  modalPanel: null,
  subscriptions: null,

  config: {
    path: {
      title: 'Stats file location',
      description: 'The location of the file where your stats are saved. Prefer an absolute path.',
      type: 'string',
      default: '~/atom-hit-stats.csv',
    },
  },

  activate(state) {
    const now = Date.now();
    const lastUpdate = state.lastUpdate || now;
    const isNewDay = isDifferentDay(lastUpdate, now);

    this.lastUpdate = isNewDay ? now : lastUpdate;
    this.count = isNewDay ? 0 : (state.count || 0);
    this.toggled = typeof state.toggled !== 'undefined' ? state.toggled : true;

    this.userConfig = atom.config.get('hit-stats');
    this.fileLocation = path.resolve(this.userConfig.path);

    this.toggle = this.toggle.bind(this);
    this.update = this.update.bind(this);
    this.writeFile = this.writeFile.bind(this);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'hit-stats:toggle': this.toggle,
    }));

    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      editor.element.addEventListener('keyup', this.update);

      this.subscriptions.add(editor.onDidSave(this.writeFile));
    }));
  },

  deactivate() {
    this.writeFile();
    this.subscriptions.dispose();
  },

  serialize() {
    return {
      count: this.count,
      toggled: this.toggled,
      lastUpdate: this.lastUpdate,
    };
  },

  toggle() {
    this.toggled = !this.toggled;
    this.statusBarElement.classList.toggle('hit-stats-hidden');
  },

  createStatusBarElement() {
    this.statusBarElement = document.createElement('span');
    this.statusBarElement.classList.add('hit-stats');

    if (!this.toggled) this.statusBarElement.classList.add('hit-stats-hidden');

    this.statusBarElement.textContent = `Hits: ${this.count}`;

    return this.statusBarElement;
  },

  consumeStatusBar(statusBar) {
    statusBar.addRightTile({
      item: this.createStatusBarElement(),
      priority: Infinity,
    });
  },

  update() {
    if (!this.toggled) return;

    const now = Date.now();

    if (isDifferentDay(this.lastUpdate, now)) {
      return this.writeFile().then(() => {
        this.count = 0;
        this.lastUpdate = now;
        this.updateView();
      });
    }

    this.count++;
    this.lastUpdate = now;
    this.updateView();
  },

  updateView() {
    this.statusBarElement.textContent = `Hits: ${this.count}`;
  },

  readFileContent() {
    if (typeof this.fileContent === 'string') return Promise.resolve();

    return new Promise(resolve => {
      fs.readFile(this.fileLocation, 'utf8', (err, res) => {
        this.fileContent = err ? '' : res;
        resolve();
      });
    });
  },

  writeFile() {
    if (!this.toggled) return;

    // currentUpdate.setHours(0);
    // currentUpdate.setMinutes(0);
    // currentUpdate.setSeconds(0);
    // currentUpdate.setMilliseconds(0);

    const lineToWrite = `${new Date(this.lastUpdate).toISOString()},${this.count}\n`;

    return this.readFileContent().then(() => {
      // console.log('before:', this.fileContent);

      const lines = this.fileContent.split('\n').slice(0, -1);
      const lastIndex = lines.length - 1;
      const lastLine = lines[lastIndex];

      if (!lastLine) this.fileContent = lineToWrite;
      else {
        const lastUpdateOnFile = new Date(lastLine.split(',')[0]).getTime();

        if (!isDifferentDay(lastUpdateOnFile, this.lastUpdate)) lines.splice(-1);

        lines.push(lineToWrite);

        this.fileContent = lines.join('\n');
      }

      // console.log('after:', this.fileContent);

      return new Promise((resolve, reject) => {
        fs.writeFile(this.fileLocation, this.fileContent, 'utf8', err => err ? reject(err) : resolve());
      });
    });
  },

};
