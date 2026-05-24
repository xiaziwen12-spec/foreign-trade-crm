// ============================================
// app.js - 主应用逻辑（路由、状态管理、云同步）
// ============================================

const App = {
  currentPage: 'dashboard',
  currentProject: 'mate-cups', // 默认马黛茶杯项目
  userName: localStorage.getItem('crm_userName') || '',
  cloudTimer: null, // 定时拉取计时器

  // 初始化
  async init() {
    // 提示用户输入名字（首次或未设置时）
    if (!this.userName) {
      this.promptUserName();
      return; // 等用户输入后再继续
    }

    // 初始化示例数据（仅首次使用时）
    DB.initSampleData();

    // 初始化云同步
    await this.initCloudSync();

    // 绑定导航事件
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.page);
      });
    });

    // 绑定项目切换事件
    document.querySelectorAll('.project-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchProject(tab.dataset.project);
      });
    });

    // 绑定模态框关闭
    document.getElementById('modal-close')?.addEventListener('click', () => Utils.closeModal());
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) Utils.closeModal();
    });

    // ESC 关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.closeModal();
    });

    // 导出/导入
    document.getElementById('btn-export')?.addEventListener('click', this.exportData.bind(this));
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-import').click();
    });
    document.getElementById('file-import')?.addEventListener('change', (e) => this.importData(e));

    // 云同步按钮
    document.getElementById('btn-cloud-settings')?.addEventListener('click', () => this.showCloudSettings());
    document.getElementById('btn-cloud-sync')?.addEventListener('click', () => this.manualSync());

    // 页面可见性变化时自动拉取（从其他标签切回来时）
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && DB.CLOUD.isConfigured()) {
        this.pullFromCloud();
      }
    });

    // 首次渲染
    this.render();

    console.log(`📦 外贸CRM已启动 | 用户: ${this.userName} | 项目: ${this.currentProject}`);
  },

  // 用户名输入弹窗
  promptUserName() {
    const name = prompt('请输入你的名字（用于标识操作人）：');
    if (name && name.trim()) {
      this.userName = name.trim();
      localStorage.setItem('crm_userName', this.userName);
      // 重新走完整初始化
      this.init();
    } else {
      // 用户取消，使用默认名
      this.userName = '用户' + Math.floor(Math.random() * 1000);
      localStorage.setItem('crm_userName', this.userName);
      this.init();
    }
  },

  // 初始化云同步
  async initCloudSync() {
    this.updateCloudStatus('checking', '检查中...');

    if (!DB.CLOUD.isConfigured()) {
      this.updateCloudStatus('disconnected', '未配置');
      return;
    }

    try {
      const result = await DB.initCloud();
      if (result) {
        this.updateCloudStatus('connected', `☁️ 已连接 (${this.userName})`);
        this.startAutoPull(); // 启动定时拉取
        Utils.showToast(`✅ 云同步已连接，欢迎 ${this.userName}`, 'success');
      } else {
        this.updateCloudStatus('error', '连接失败');
      }
    } catch (err) {
      console.error('云初始化失败:', err);
      this.updateCloudStatus('error', '连接错误');
    }
  },

  // 更新云状态显示
  updateCloudStatus(state, text) {
    const dot = document.getElementById('cloud-dot');
    const txt = document.getElementById('cloud-text');
    if (!dot || !txt) return;

    dot.className = 'cloud-dot ' + state;
    txt.textContent = text;

    // 同步按钮可用/禁用
    const syncBtn = document.getElementById('btn-cloud-sync');
    if (syncBtn) {
      syncBtn.disabled = state === 'disconnected';
      syncBtn.style.opacity = state === 'disconnected' ? '0.5' : '1';
    }
  },

  // 手动立即同步
  async manualSync() {
    if (!DB.CLOUD.isConfigured()) {
      Utils.showToast('⚠️ 请先配置云同步（点击设置）', 'warning');
      this.showCloudSettings();
      return;
    }

    const btn = document.getElementById('btn-cloud-sync');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    this.updateCloudStatus('syncing', '同步中...');
    try {
      // 先推后拉
      await DB.cloudPush();
      await DB.cloudPull();
      this.render();
      this.updateCloudStatus('connected', `☁️ 已连接 (${this.userName})`);
      Utils.showToast('✅ 云同步完成', 'success');
    } catch (err) {
      console.error('同步失败:', err);
      this.updateCloudStatus('error', '同步失败');
      Utils.showToast('❌ 同步失败: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 同步'; }
    }
  },

  // 从云端拉取（静默，不弹toast）
  async pullFromCloud() {
    if (!DB.CLOUD.isConfigured()) return;
    try {
      await DB.cloudPull();
      this.render(); // 静默刷新页面
    } catch (e) {
      console.warn('后台拉取失败:', e);
    }
  },

  // 启动定时自动拉取（每60秒）
  startAutoPull() {
    if (this.cloudTimer) clearInterval(this.cloudTimer);
    this.cloudTimer = setInterval(() => this.pullFromCloud(), 60000);
  },

  // 显示云设置模态框
  showCloudSettings() {
    const currentKey = DB.CLOUD.apiKey || '';
    const currentBin = DB.CLOUD.binId || '';

    const html = `
      <div style="max-width:480px">
        <p style="color:#666;margin-bottom:16px;font-size:14px;">
          配置 JSONBin.io 云存储后，你和同事可以实时共享同一份数据。
          <a href="https://jsonbin.io" target="_blank" style="color:#4f46e5">免费注册 →</a>
        </p>

        <label class="form-label">API Key</label>
        <input type="text" id="set-apikey" class="form-input"
               placeholder="粘贴你的JSONBin API Key"
               value="${currentKey}"
               style="width:100%;margin-bottom:12px">

        <label class="form-label">Bin ID</label>
        <input type="text" id="set-binid" class="form-input"
               placeholder="粘贴你的 Bin ID（如：6xxxxx）"
               value="${currentBin}"
               style="width:100%;margin-bottom:8px">

        <div style="background:#f8f9fa;padding:10px;border-radius:6px;font-size:12px;color:#666;margin-bottom:16px">
          <strong>如何获取：</strong><br>
          1. 访问 <strong>jsonbin.io</strong> 注册账号<br>
          2. 创建一个 New Bin（内容留空或写 {} 即可）<br>
          3. 复制 API Key 和 Bin ID 填入上方<br>
          4. 免费版足够2人使用 ✅
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" onclick="App.saveCloudSettings()">💾 保存并连接</button>
          ${currentKey ? '<button class="btn btn-outline" onclick="App.testConnection()" style="margin-left:8px">🔗 测试连接</button>' : ''}
        </div>
      </div>
    `;

    Utils.openModal('☁️ 云同步设置', html);
  },

  // 保存云设置
  async saveCloudSettings() {
    const apiKey = document.getElementById('set-apikey').value.trim();
    const binId = document.getElementById('set-binid').value.trim();

    if (!apiKey || !binId) {
      Utils.showToast('⚠️ 请填写完整的 API Key 和 Bin ID', 'warning');
      return;
    }

    // 存储到 localStorage
    localStorage.setItem('crm_cloudApiKey', apiKey);
    localStorage.setItem('crm_cloudBinId', binId);

    // 更新内存中的配置
    DB.CLOUD.apiKey = apiKey;
    DB.CLOUD.binId = binId;

    Utils.closeModal();
    Utils.showToast('⚙️ 设置已保存，正在连接...', 'info');

    // 尝试重新初始化
    await this.initCloudSync();
  },

  // 测试连接
  async testConnection() {
    Utils.showToast('🔗 正在测试连接...', 'info');
    try {
      const result = await DB.CLOUD.fetchAll();
      if (result !== null) {
        Utils.showToast('✅ 连接成功！数据正常', 'success');
      } else {
        Utils.showToast('⚠️ 连通但无数据（可能是新Bin，正常）', 'warning');
      }
    } catch (e) {
      Utils.showToast('❌ 连接失败: ' + e.message, 'error');
    }
  },

  // 页面导航
  navigate(page) {
    this.currentPage = page;

    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    this.render();
  },

  // 项目切换
  switchProject(project) {
    this.currentProject = project;

    // 更新项目标签样式
    document.querySelectorAll('.project-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.project === project);
    });

    // 重置筛选条件
    Customers.currentFilter = { stage: '', search: '' };
    Orders.currentFilter = { status: '', search: '' };
    Products.currentFilter = { category: '', search: '' };

    this.render();
    Utils.showToast(`已切换到${project === 'coffee-cups' ? '☕ 咖啡纸杯' : '🧉 马黛茶杯'}项目`, 'info');
  },

  // 主渲染函数
  render() {
    const appEl = document.getElementById('app');
    const project = this.currentProject;
    let html = '';

    switch (this.currentPage) {
      case 'dashboard':
        html = Dashboard.render(project);
        break;
      case 'customers':
        html = Customers.render(project);
        break;
      case 'orders':
        html = Orders.render(project);
        break;
      case 'products':
        html = Products.render(project);
        break;
      case 'finance':
        html = Orders.renderFinance(project);
        break;
      default:
        html = Dashboard.render(project);
    }

    appEl.innerHTML = html;
  },

  // 滚动到客户行（供Dashboard调用）
  scrollToCustomer(id) {
    if (this.currentPage !== 'customers') {
      this.navigate('customers');
      setTimeout(() => Customers.scrollToCustomer(id), 300);
    } else {
      Customers.scrollToCustomer(id);
    }
  },

  // 数据导出
  exportData() {
    const data = DB.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast('✅ 数据已导出为JSON文件', 'success');
  },

  // 数据导入
  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (Utils.confirm('⚠️ 导入将覆盖当前所有数据！确定要继续吗？')) {
        const success = DB.importAll(e.target.result);
        if (success) {
          Utils.showToast('✅ 数据导入成功！', 'success');
          // 导入后也推送到云端
          if (DB.CLOUD.isConfigured()) {
            DB.scheduleCloudSync();
          }
          this.render();
        } else {
          Utils.showToast('❌ 导入失败，请检查文件格式', 'error');
        }
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // 重置以便重复选择同一文件
  }
};

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());
