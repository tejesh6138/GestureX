/**
 * AI Gesture Runner 3D - ResultsScreen
 * Player career statistics, achievement trophies, and coin-aware leaderboard interface.
 * Normalized for future Django REST Framework + PostgreSQL cloud integration.
 */

import { Score } from '../services/ScoreService.js';
import { Achievements } from '../services/AchievementService.js';
import { ApiClient } from '../services/ApiClient.js';
import { Sound } from '../services/SoundService.js';
import { MathUtils } from '../utils/MathUtils.js';

export class ResultsScreen {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.element = null;
    this.activeLeaderboardView = 'local'; // 'local' or 'global'

    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.id = 'results-screen';
    this.element.className = 'screen-overlay hidden';

    this.element.innerHTML = `
      <div class="results-content glass-card">
        <h2 class="section-title">CAREER & <span class="neon-accent">LEADERBOARDS</span></h2>

        <!-- Main Tab Selector -->
        <div class="results-tabs">
          <button id="tab-btn-stats" class="tab-btn active">📊 CAREER STATS</button>
          <button id="tab-btn-leaderboard" class="tab-btn">🏆 LEADERBOARDS</button>
          <button id="tab-btn-achieve" class="tab-btn">🎖️ ACHIEVEMENTS</button>
        </div>

        <!-- Tab 1: Career Overview Stats -->
        <div id="tab-stats" class="tab-pane active">
          <div class="stats-overview-grid">
            <div class="overview-box">
              <span class="ov-label">PERSONAL BEST SCORE</span>
              <span id="ov-high-score" class="ov-val highlight">0</span>
            </div>
            <div class="overview-box">
              <span class="ov-label">BEST DISTANCE</span>
              <span id="ov-best-distance" class="ov-val">0 m</span>
            </div>
            <div class="overview-box">
              <span class="ov-label">HIGHEST RUN COINS</span>
              <span class="ov-val-coins">
                <span class="coin-icon">🪙</span>
                <span id="ov-highest-run-coins">0</span>
              </span>
            </div>
            <div class="overview-box">
              <span class="ov-label">TOTAL LIFETIME COINS</span>
              <span class="ov-val-coins">
                <span class="coin-icon">🪙</span>
                <span id="ov-total-coins">0</span>
              </span>
            </div>
            <div class="overview-box full-width">
              <span class="ov-label">COMPLETED RUNS</span>
              <span id="ov-games-played" class="ov-val">0</span>
            </div>
          </div>
        </div>

        <!-- Tab 2: Coin-Aware Leaderboards (Local & Global) -->
        <div id="tab-leaderboard" class="tab-pane hidden">
          <!-- Sub-toggle: Local vs Global -->
          <div class="leaderboard-subnav">
            <button id="sub-btn-local" class="sub-tab-btn active">🏅 Local Records</button>
            <button id="sub-btn-global" class="sub-tab-btn">🌐 Cloud Leaderboard</button>
          </div>

          <div class="leaderboard-meta-bar">
            <span class="metric-tag">RANKING METRIC: <strong>SCORE</strong></span>
            <span class="storage-tag" id="lb-storage-tag">LOCAL STORAGE</span>
          </div>

          <!-- Local Leaderboard View -->
          <div id="leaderboard-local-view" class="leaderboard-table-container">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>RUN</th>
                  <th>SCORE</th>
                  <th>COINS</th>
                  <th>DISTANCE</th>
                </tr>
              </thead>
              <tbody id="leaderboard-local-body">
                <!-- Dynamically populated -->
              </tbody>
            </table>
            <div id="leaderboard-empty-msg" class="leaderboard-empty hidden">
              No completed runs recorded yet. Start a run to establish your personal ranking!
            </div>
          </div>

          <!-- Global Cloud Leaderboard View -->
          <div id="leaderboard-global-view" class="leaderboard-global-view hidden">
            <div class="leaderboard-status-card">
              <div class="status-icon">🔌</div>
              <h3 id="cloud-status-title">STANDALONE CLIENT MODE</h3>
              <p id="leaderboard-msg">
                Global cloud leaderboards require a connected Django REST Framework + PostgreSQL backend server.
                Personal scores and coin records are actively tracked in local browser persistence.
              </p>
              <div class="backend-notice-pill">
                API Endpoint: <code>/api/v1/scores/leaderboard/</code> (Offline)
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Achievements Grid -->
        <div id="tab-achieve" class="tab-pane hidden">
          <div id="achievements-grid" class="achievements-grid"></div>
        </div>

        <!-- Bottom Actions -->
        <div class="results-actions">
          <button id="btn-results-start" class="btn btn-primary btn-glow">
            ▶ PLAY NOW
          </button>
          <button id="btn-results-back" class="btn btn-secondary">
            ⬅ BACK TO MENU
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  bindEvents() {
    const tabBtns = this.element.querySelectorAll('.tab-btn');
    const tabPanes = this.element.querySelectorAll('.tab-pane');

    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        Sound.playClick();
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.add('hidden'));

        btn.classList.add('active');
        if (btn.id === 'tab-btn-stats') this.element.querySelector('#tab-stats').classList.remove('hidden');
        if (btn.id === 'tab-btn-leaderboard') {
          this.element.querySelector('#tab-leaderboard').classList.remove('hidden');
          this.renderLeaderboards();
        }
        if (btn.id === 'tab-btn-achieve') this.element.querySelector('#tab-achieve').classList.remove('hidden');
      };
    });

    // Subnav for Local vs Global
    const subLocal = this.element.querySelector('#sub-btn-local');
    const subGlobal = this.element.querySelector('#sub-btn-global');
    const viewLocal = this.element.querySelector('#leaderboard-local-view');
    const viewGlobal = this.element.querySelector('#leaderboard-global-view');
    const storageTag = this.element.querySelector('#lb-storage-tag');

    subLocal.onclick = () => {
      Sound.playClick();
      subLocal.classList.add('active');
      subGlobal.classList.remove('active');
      viewLocal.classList.remove('hidden');
      viewGlobal.classList.add('hidden');
      storageTag.textContent = 'LOCAL STORAGE';
      this.renderLocalLeaderboard();
    };

    subGlobal.onclick = () => {
      Sound.playClick();
      subGlobal.classList.add('active');
      subLocal.classList.remove('active');
      viewGlobal.classList.remove('hidden');
      viewLocal.classList.add('hidden');
      storageTag.textContent = 'CLOUD API';
      this.renderGlobalLeaderboard();
    };

    this.element.querySelector('#btn-results-start').onclick = () => {
      Sound.playClick();
      this.onAction('START');
    };

    this.element.querySelector('#btn-results-back').onclick = () => {
      Sound.playClick();
      this.onAction('BACK');
    };
  }

  renderLocalLeaderboard() {
    const tbody = this.element.querySelector('#leaderboard-local-body');
    const emptyMsg = this.element.querySelector('#leaderboard-empty-msg');
    tbody.innerHTML = '';

    const records = Score.getLocalLeaderboard('score');
    if (!records || records.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }

    emptyMsg.classList.add('hidden');
    records.slice(0, 15).forEach((rec) => {
      const tr = document.createElement('tr');
      if (rec.rank === 1) tr.className = 'top-rank';

      const rankBadge = rec.rank === 1 ? '🥇 1' : rec.rank === 2 ? '🥈 2' : rec.rank === 3 ? '🥉 3' : `#${rec.rank}`;

      const diffBadge = rec.difficulty ? `<span class="diff-badge-mini ${rec.difficulty.toLowerCase()}">${rec.difficulty}</span> ` : '';

      tr.innerHTML = `
        <td class="col-rank">${rankBadge}</td>
        <td class="col-name">${diffBadge}${rec.displayName}</td>
        <td class="col-score highlight">${MathUtils.formatNumber(rec.bestScore)}</td>
        <td class="col-coins"><span class="coin-mini">🪙</span> ${MathUtils.formatNumber(rec.coinsCollected)}</td>
        <td class="col-dist">${MathUtils.formatDistance(rec.bestDistance)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderGlobalLeaderboard() {
    const msg = this.element.querySelector('#leaderboard-msg');
    const title = this.element.querySelector('#cloud-status-title');

    ApiClient.fetchLeaderboard().then((res) => {
      if (!res.available) {
        title.textContent = 'STANDALONE CLIENT MODE';
        msg.textContent = 'Global cloud leaderboards require a connected Django REST Framework + PostgreSQL server. Personal statistics are preserved in local storage.';
      } else {
        title.textContent = 'CLOUD LEADERBOARD CONNECTED';
        msg.textContent = res.message;
      }
    });
  }

  renderLeaderboards() {
    this.renderLocalLeaderboard();
  }

  refresh() {
    const pb = Score.getPersonalBest();
    this.element.querySelector('#ov-high-score').textContent = MathUtils.formatNumber(pb.score);
    this.element.querySelector('#ov-best-distance').textContent = MathUtils.formatDistance(pb.distanceTravelled);
    this.element.querySelector('#ov-highest-run-coins').textContent = MathUtils.formatNumber(Score.getHighestRunCoins());
    this.element.querySelector('#ov-total-coins').textContent = MathUtils.formatNumber(Score.getTotalCoins());
    this.element.querySelector('#ov-games-played').textContent = MathUtils.formatNumber(Score.getGamesPlayed());

    // Populate Achievements
    const grid = this.element.querySelector('#achievements-grid');
    grid.innerHTML = '';
    const allAch = Achievements.getAllAchievements();

    allAch.forEach((ach) => {
      const card = document.createElement('div');
      card.className = `achievement-item ${ach.isUnlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <div class="ach-icon">${ach.icon}</div>
        <div class="ach-info">
          <div class="ach-title">${ach.title}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
        <div class="ach-status">${ach.isUnlocked ? 'UNLOCKED' : 'LOCKED'}</div>
      `;
      grid.appendChild(card);
    });

    this.renderLeaderboards();
  }

  show() {
    this.refresh();
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
