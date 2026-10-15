/**
 * AI Gesture Runner 3D - ResultsScreen
 * Player career statistics, achievement trophies, and real-time cloud-connected leaderboard.
 * Integrates live Django REST Framework + Neon PostgreSQL APIs with graceful local fallback.
 */

import { Score } from '../services/ScoreService.js';
import { Achievements } from '../services/AchievementService.js';
import { ApiClient } from '../services/ApiClient.js';
import { AuthService } from '../services/AuthService.js';
import { Sound } from '../services/SoundService.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GlobalEvents } from '../core/EventBus.js';

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
              <span class="ov-label">GLOBAL RANK</span>
              <span id="ov-global-rank" class="ov-val highlight">Unranked</span>
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
            <div class="overview-box">
              <span class="ov-label">COMPLETED RUNS</span>
              <span id="ov-games-played" class="ov-val">0</span>
            </div>
          </div>
          <div id="stats-auth-notice" class="field-hint" style="text-align: center; margin-top: 14px;">
            <!-- Injected dynamically -->
          </div>
        </div>

        <!-- Tab 2: Coin-Aware Leaderboards (Local & Global) -->
        <div id="tab-leaderboard" class="tab-pane hidden">
          <!-- Sub-toggle: Local vs Global -->
          <div class="leaderboard-subnav">
            <button id="sub-btn-local" class="sub-tab-btn active">🏅 Local Records</button>
            <button id="sub-btn-global" class="sub-tab-btn">🌐 Neon Cloud Leaderboard</button>
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
          <div id="leaderboard-global-view" class="leaderboard-table-container hidden">
            <div id="global-loading-indicator" class="leaderboard-empty">
              ⚡ Loading live rankings from Neon PostgreSQL Cloud...
            </div>
            <table id="global-leaderboard-table" class="leaderboard-table hidden">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>RUNNER</th>
                  <th>SCORE</th>
                  <th>COINS</th>
                  <th>DIFFICULTY</th>
                </tr>
              </thead>
              <tbody id="leaderboard-global-body">
                <!-- Dynamically populated from API -->
              </tbody>
            </table>
            <div id="global-leaderboard-empty" class="leaderboard-empty hidden">
              No global runs saved to Neon Cloud yet. Be the first to claim Rank #1!
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
      storageTag.textContent = 'NEON POSTGRESQL CLOUD';
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

  async renderGlobalLeaderboard() {
    const loader = this.element.querySelector('#global-loading-indicator');
    const table = this.element.querySelector('#global-leaderboard-table');
    const tbody = this.element.querySelector('#leaderboard-global-body');
    const emptyMsg = this.element.querySelector('#global-leaderboard-empty');

    loader.classList.remove('hidden');
    loader.textContent = '⚡ Loading live rankings from Neon PostgreSQL Cloud...';
    table.classList.add('hidden');
    emptyMsg.classList.add('hidden');
    tbody.innerHTML = '';

    try {
      const res = await ApiClient.fetchLeaderboard(50, 'players');

      loader.classList.add('hidden');

      if (!res.ok) {
        loader.textContent = res.offline
          ? '⚠️ Backend offline. Connect backend to view Neon Cloud rankings.'
          : '⚠️ Could not load global rankings.';
        loader.classList.remove('hidden');
        return;
      }

      const entries = res.data?.leaderboard || [];
      if (entries.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
      }

      table.classList.remove('hidden');
      const currentUser = AuthService.getUser();

      entries.forEach((entry) => {
        const tr = document.createElement('tr');
        const isCurrentPlayer = currentUser && currentUser.username === entry.username;
        if (isCurrentPlayer) {
          tr.className = 'top-rank current-user-row';
        } else if (entry.rank === 1) {
          tr.className = 'top-rank';
        }

        const rankBadge = entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : `#${entry.rank}`;
        const diffBadge = entry.difficulty ? `<span class="diff-badge-mini ${entry.difficulty.toLowerCase()}">${entry.difficulty}</span> ` : '';

        tr.innerHTML = `
          <td class="col-rank">${rankBadge}</td>
          <td class="col-name">${diffBadge}${entry.display_name}${isCurrentPlayer ? ' (You)' : ''}</td>
          <td class="col-score highlight">${MathUtils.formatNumber(entry.score)}</td>
          <td class="col-coins"><span class="coin-mini">🪙</span> ${MathUtils.formatNumber(entry.coins)}</td>
          <td class="col-diff">${entry.difficulty}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch {
      loader.textContent = '⚠️ Network error communicating with Neon Cloud.';
      loader.classList.remove('hidden');
    }
  }

  renderLeaderboards() {
    this.renderLocalLeaderboard();
  }

  async refresh() {
    const pb = Score.getPersonalBest();
    const ovScore = this.element.querySelector('#ov-high-score');
    const ovDist = this.element.querySelector('#ov-best-distance');
    const ovHighestCoins = this.element.querySelector('#ov-highest-run-coins');
    const ovTotalCoins = this.element.querySelector('#ov-total-coins');
    const ovGames = this.element.querySelector('#ov-games-played');
    const ovRank = this.element.querySelector('#ov-global-rank');
    const notice = this.element.querySelector('#stats-auth-notice');

    // Default to local records
    ovScore.textContent = MathUtils.formatNumber(pb.score);
    ovDist.textContent = MathUtils.formatDistance(pb.distanceTravelled);
    ovHighestCoins.textContent = MathUtils.formatNumber(Score.getHighestRunCoins());
    ovTotalCoins.textContent = MathUtils.formatNumber(Score.getTotalCoins());
    ovGames.textContent = MathUtils.formatNumber(Score.getGamesPlayed());
    ovRank.textContent = 'Unranked (Guest)';

    if (AuthService.isLoggedIn()) {
      notice.innerHTML = '⚡ Synchronized with Neon Cloud Database';
      notice.style.color = 'var(--success-green)';

      // Pull server authoritative career stats
      try {
        const statsRes = await ApiClient.fetchCareerStats();
        if (statsRes.ok && statsRes.data) {
          const s = statsRes.data;
          if (s.highest_score > 0) ovScore.textContent = MathUtils.formatNumber(s.highest_score);
          if (s.best_distance > 0) ovDist.textContent = MathUtils.formatDistance(s.best_distance);
          if (s.best_coins_single_run > 0) ovHighestCoins.textContent = MathUtils.formatNumber(s.best_coins_single_run);
          if (s.total_coins > 0) ovTotalCoins.textContent = MathUtils.formatNumber(s.total_coins);
          if (s.total_runs > 0) ovGames.textContent = MathUtils.formatNumber(s.total_runs);
          ovRank.textContent = s.global_rank ? `#${s.global_rank}` : 'Unranked';
        }
      } catch {}
    } else {
      notice.innerHTML = '👤 Guest Mode: Running in local browser storage. <a href="#" id="link-results-guest-login" style="color:var(--primary-blue);text-decoration:underline;cursor:pointer;">Log in</a> to claim your global rank.';
      notice.style.color = 'var(--text-secondary)';
      const link = notice.querySelector('#link-results-guest-login');
      if (link) {
        link.onclick = (e) => {
          e.preventDefault();
          GlobalEvents.emit('OPEN_AUTH_MODAL', { view: 'LOGIN' });
        };
      }
    }

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
