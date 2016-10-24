'use babel';

import os from 'os';
import fs from 'fs';
import path from 'path';
import { CompositeDisposable } from 'atom';

export default {

  keyCountStatsView: null,
  modalPanel: null,
  subscriptions: null,

  config: {
    path: {
      title: 'Stats file location',
      description: 'The location of the file where your stats are saved. Prefer absolute path.',
      type: 'string',
      default: 'atom-hit-stats.csv',
    },
  },

  activate(state) {
    this.toggled = state.toggled || true;
    this.lastUpdate = state.lastUpdate ? new Date(state.lastUpdate) : new Date();
    this.count = this.isDifferentDay(this.lastUpdate, new Date()) ? 0 : (state.count || 0);

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

      this.subscriptions.add(editor.onDidSave(this.writeFile))
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
      lastUpdate: this.lastUpdate.toISOString(),
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

  isDifferentDay(previousDate, nextDate) {
    return (
      previousDate.getDate() !== nextDate.getDate() ||
      previousDate.getMonth() !== nextDate.getMonth() ||
      previousDate.getFullYear() !== nextDate.getFullYear()
    );
  },

  update() {
    if (!this.toggled) return;

    const nextUpdate = new Date();

    if (this.isDifferentDay(this.lastUpdate, nextUpdate)) {
      this.writeFile();
      this.count = 0;
    }

    this.count++;
    this.lastUpdate = nextUpdate;
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

    const currentUpdate = new Date(this.lastUpdate);

    currentUpdate.setHours(0);
    currentUpdate.setMinutes(0);
    currentUpdate.setSeconds(0);
    currentUpdate.setMilliseconds(1);

    const lineToWrite = `${currentUpdate.toISOString()},${this.count}${os.EOL}`;

    this.readFileContent().then(() => {
      // console.log('before:', this.fileContent);

      const lines = this.fileContent.split('\n');
      const lastIndex = lines.length - 1;
      const lastLineArray = lines[lastIndex].split(',');
      const lastUpdateOnFile = lastLineArray[0] ? new Date(lastLineArray[0]) : new Date();

      this.fileContent = (this.isDifferentDay(lastUpdateOnFile, currentUpdate) ? lines : lines.slice(0, lastIndex))
        .concat([lineToWrite])
        .join('\n');

      // console.log('after:', this.fileContent);

      fs.writeFile(this.fileLocation, this.fileContent, 'utf8');
    });
  },

};
